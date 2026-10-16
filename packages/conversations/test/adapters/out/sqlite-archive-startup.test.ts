import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, sql, SqliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Turn } from '../../../src/domain/turn.js';
import { openConversationArchive } from '../../../src/adapters/out/sqlite/conversation-archive.js';
import { conversationMigrations } from '../../../src/adapters/out/sqlite/migrations.js';
import { SqliteConversationWrite } from '../../../src/adapters/out/sqlite/sqlite-conversation-write.adapter.js';
import type { ConversationDatabase } from '../../../src/adapters/out/sqlite/schema.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
const otherConversationId = 'ab02e7da-7a10-4585-8b09-ab8f6b4b93ee';
const otherTurnId = '82d590bb-216d-407d-8034-55f1db4a3212';
const directories: string[] = [];

function file() {
  const directory = mkdtempSync(join(tmpdir(), 'ambrogio-startup-'));
  directories.push(directory);
  return join(directory, 'conversations.sqlite');
}

function turn(id: string) {
  return Turn.accept({ id, text: '  domanda  ', acceptedAt: new Date(1234) });
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('conversation archive startup', () => {
  it('migrates a legacy active turn to its conversation before recovery', async () => {
    const filename = file();
    const sqlite = new Database(filename);
    const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
    const migrator = new Migrator({ db, provider: { async getMigrations() { return conversationMigrations; } } });
    try {
      expect((await migrator.migrateTo('005_remove_turn_owner')).error).toBeUndefined();
      await db.insertInto('conversations').values({ id: conversationId, created_at: 100,
        last_activity_at: 100 }).execute();
      await db.insertInto('turns').values({ id: turnId, conversation_id: conversationId,
        ordinal: 1, text: 'legacy', accepted_at: 100, status: 'pending',
        answer: null, error: null, finished_at: null }).execute();
      await db.updateTable('installation').set({ active_turn_id: turnId }).where('id', '=', 1).execute();
      expect((await migrator.migrateToLatest()).error).toBeUndefined();
      expect(await db.selectFrom('conversations').select('active_turn_id')
        .where('id', '=', conversationId).executeTakeFirst()).toEqual({ active_turn_id: turnId });
      const tables = await sql<{ name: string }>`select name from sqlite_master where type = 'table'`.execute(db);
      expect(tables.rows.map(row => row.name)).not.toContain('installation');
    } finally { await db.destroy(); }
  });

  it('migrates an archive with the former PID column and recovers its pending turn before returning', async () => {
    const filename = file();
    const sqlite = new Database(filename);
    const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
    const migrator = new Migrator({ db, provider: { async getMigrations() { return conversationMigrations; } } });
    expect((await migrator.migrateTo('004_turn_owner')).error).toBeUndefined();
    await db.insertInto('conversations').values({ id: conversationId, created_at: 1234, last_activity_at: 1234 }).execute();
    await db.insertInto('turns').values({
      id: turnId, conversation_id: conversationId, ordinal: 1, text: '  domanda  ',
      accepted_at: 1234, status: 'pending', answer: null, error: null, finished_at: null,
    }).execute();
    await sql`update installation set active_turn_id = ${turnId}, active_process_id = ${process.pid} where id = 1`.execute(db);
    await db.destroy();

    const archive = await openConversationArchive(filename, new Date(2345));
    expect(archive.recoveredTurns).toBe(1);
    expect(await archive.db.selectFrom('turns').select(['text', 'status', 'finished_at']).executeTakeFirst())
      .toEqual({ text: '  domanda  ', status: 'interrupted', finished_at: 2345 });
    expect(await archive.db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationId).executeTakeFirst())
      .toEqual({ active_turn_id: null });
    const columns = await sql<{ name: string }>`pragma table_info(conversations)`.execute(archive.db);
    expect(columns.rows.map(column => column.name)).toContain('active_turn_id');
    await archive.close();
    const reopened = await openConversationArchive(filename, new Date(3456));
    expect(reopened.recoveredTurns).toBe(0);
    await reopened.close();
  });

  it('interrupts every pending turn and releases occupancy before admitting a new one', async () => {
    const filename = file();
    const first = await openConversationArchive(filename, new Date(1000));
    const writer = new SqliteConversationWrite(first.db);
    expect(await writer.admit({ conversationId, createConversation: true, turn: turn(turnId) }))
      .toMatchObject({ ok: true });
    await first.db.insertInto('conversations').values({
      id: otherConversationId, created_at: 1234, last_activity_at: 1234,
    }).execute();
    await first.db.insertInto('turns').values({
      id: otherTurnId, conversation_id: otherConversationId, ordinal: 1, text: 'altro',
      accepted_at: 1234, status: 'pending', answer: null, error: null, finished_at: null,
    }).execute();
    await first.close();

    const second = await openConversationArchive(filename, new Date(2345));
    expect(second.recoveredTurns).toBe(2);
    expect(await second.db.selectFrom('turns').select(['status', 'finished_at']).execute())
      .toEqual([{ status: 'interrupted', finished_at: 2345 }, { status: 'interrupted', finished_at: 2345 }]);
    expect(await second.db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationId).executeTakeFirst())
      .toEqual({ active_turn_id: null });
    expect(await new SqliteConversationWrite(second.db).admit({
      conversationId: otherConversationId, createConversation: false,
      turn: turn('13209c7e-c941-44df-a28b-a34bb7e29e10'),
    })).toMatchObject({ ok: true });
    await second.close();
  });

  it('fails preparation when a migration fails, before an archive becomes available', async () => {
    const filename = file();
    const sqlite = new Database(filename);
    sqlite.exec('create table conversations (conflicting text)');
    sqlite.close();
    const destroy = vi.spyOn(Kysely.prototype, 'destroy');
    try {
      await expect(openConversationArchive(filename, new Date(1000))).rejects.toThrow();
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally { destroy.mockRestore(); }
  });
});
