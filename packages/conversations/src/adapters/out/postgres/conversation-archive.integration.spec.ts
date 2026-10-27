import { afterEach, describe, expect, it, vi } from 'vitest';
import { Kysely, sql } from 'kysely';
import pg from 'pg';
import { emptyTestDatabase } from '../../../../../../test/support/test-database.js';
import { admitTurn, interruptPendingTurns } from '../../../../test/support/turn-archive.js';
import { openConversationArchive } from './conversation-archive.js';
import { PostgresTurnRepository } from './postgres-turn-repository.adapter.js';
import type { TemporaryDatabase } from './temporary-database.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
const otherConversationId = 'ab02e7da-7a10-4585-8b09-ab8f6b4b93ee';
const otherTurnId = '82d590bb-216d-407d-8034-55f1db4a3212';
const databases: TemporaryDatabase[] = [];

async function database(): Promise<TemporaryDatabase> {
  const created = await emptyTestDatabase();
  databases.push(created);
  return created;
}

function turn(id: string) {
  return ({ id, text: '  domanda  ', acceptedAt: new Date(1234) });
}

const ignoreFault = () => undefined;

/** Opens and migrates the archive, then interrupts the pending turns as the server does at startup. */
async function openRecovered(url: string, at: Date) {
  const archive = await openConversationArchive(url, ignoreFault);
  return { ...archive, recoveredTurns: await interruptPendingTurns(archive.db, at) };
}

afterEach(async () => {
  for (const created of databases.splice(0)) await created.drop();
});

describe('conversation archive startup', () => {
  it('interrupts every pending turn and releases occupancy before admitting a new one', async () => {
    const { url } = await database();
    const first = await openRecovered(url, new Date(1000));
    expect(first.recoveredTurns).toBe(0);
    const writer = new PostgresTurnRepository(first.db);
    expect(await admitTurn(writer, { conversationId, createConversation: true, turn: turn(turnId) }))
      .toMatchObject({ ok: true });
    await first.db.insertInto('conversations').values({
      id: otherConversationId, created_at: new Date(1234), last_activity_at: new Date(1234), active_turn_id: null,
    }).execute();
    // A pending turn always holds the occupancy of its conversation, written in the same transaction.
    await first.db.insertInto('turns').values({
      id: otherTurnId, conversation_id: otherConversationId, ordinal: 1, text: 'altro',
      accepted_at: new Date(1234), status: 'pending', answer: null, error: null, finished_at: null, agent: null, actions: null,
    }).execute();
    await first.db.updateTable('conversations').set({ active_turn_id: otherTurnId })
      .where('id', '=', otherConversationId).execute();
    await first.close();

    const second = await openRecovered(url, new Date(2345));
    expect(second.recoveredTurns).toBe(2);
    expect(await second.db.selectFrom('turns').select(['text', 'status', 'finished_at']).orderBy('id').execute())
      .toEqual([{ text: '  domanda  ', status: 'interrupted', finished_at: new Date(2345) },
        { text: 'altro', status: 'interrupted', finished_at: new Date(2345) }]);
    expect(await second.db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationId).executeTakeFirst())
      .toEqual({ active_turn_id: null });
    expect(await admitTurn(new PostgresTurnRepository(second.db), {
      conversationId: otherConversationId, createConversation: false,
      turn: turn('13209c7e-c941-44df-a28b-a34bb7e29e10'),
    })).toMatchObject({ ok: true });
    await second.close();
    const third = await openRecovered(url, new Date(3456));
    expect(third.recoveredTurns).toBe(1);
    await third.close();
  });

  it('fails preparation when a migration fails, before an archive becomes available', async () => {
    const { url } = await database();
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('create table conversations (conflicting text)');
    await client.end();
    const destroy = vi.spyOn(Kysely.prototype, 'destroy');
    try {
      await expect(openConversationArchive(url, ignoreFault)).rejects.toThrow();
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally { destroy.mockRestore(); }
  });

  it('fails preparation when the database does not accept the connection', async () => {
    const { url } = await database();
    const missing = new URL(url);
    missing.pathname = '/ambrogio_test_missing';
    await expect(openConversationArchive(missing.toString(), ignoreFault)).rejects.toThrow();
  });
});

describe('conversation archive resource', () => {
  // Verification: Prova della chiusura della risorsa PostgreSQL
  it('destroys the owned instance once for repeated and concurrent closing', async () => {
    const { url } = await database();
    const archive = await openConversationArchive(url, ignoreFault);
    const destroy = vi.spyOn(archive.db, 'destroy');
    const first = archive.close();
    const concurrent = archive.close();
    expect(concurrent).toBe(first);
    await first;
    expect(archive.close()).toBe(first);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  // Verification: Prova della chiusura della risorsa PostgreSQL
  it('reports each fault of an idle connection once and goes on with a new connection', async () => {
    const { url } = await database();
    const faults: unknown[] = [];
    const archive = await openConversationArchive(url, error => faults.push(error));
    try {
      const { rows: [own] } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(archive.db);
      const admin = new pg.Client({ connectionString: url });
      await admin.connect();
      try {
        await admin.query('select pg_terminate_backend($1)', [own!.pid]);
      } finally { await admin.end(); }
      await vi.waitFor(() => expect(faults).toHaveLength(1));
      const { rows: [next] } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(archive.db);
      expect(next!.pid).not.toBe(own!.pid);
      expect(faults).toHaveLength(1);
    } finally { await archive.close(); }
  });
});
