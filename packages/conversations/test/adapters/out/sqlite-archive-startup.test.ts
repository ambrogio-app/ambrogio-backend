import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Turn } from '../../../src/domain/turn.js';
import { openConversationArchive } from '../../../src/adapters/out/sqlite/conversation-archive.js';
import { conversationMigrations } from '../../../src/adapters/out/sqlite/migrations.js';
import { SqliteConversationWrite } from '../../../src/adapters/out/sqlite/sqlite-conversation-write.js';
import type { ConversationDatabase } from '../../../src/adapters/out/sqlite/schema.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
const otherConversationId = 'ab02e7da-7a10-4585-8b09-ab8f6b4b93ee';
const otherTurnId = '82d590bb-216d-407d-8034-55f1db4a3212';
const directories: string[] = [];
const children: ChildProcess[] = [];

function event(child: ChildProcess, name: 'spawn' | 'exit'): Promise<void> {
  return new Promise(resolve => {
    (child as unknown as { once(event: string, listener: () => void): void })
      .once(name, () => resolve());
  });
}

function file() {
  const directory = mkdtempSync(join(tmpdir(), 'ambrogio-startup-'));
  directories.push(directory);
  return join(directory, 'conversations.sqlite');
}

function turn(id: string) {
  return Turn.accept({ id, text: '  domanda  ', acceptedAt: new Date(1234) });
}

async function liveProcess(): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  children.push(child);
  await event(child, 'spawn');
  return child;
}

afterEach(async () => {
  await Promise.all(children.splice(0).map(async child => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await event(child, 'exit');
    }
  }));
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('conversation archive startup', () => {
  it('migrates a previous schema, preserves history, and recovers an orphan before returning the archive', async () => {
    const filename = file();
    const sqlite = new Database(filename);
    const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
    const migrator = new Migrator({ db, provider: { async getMigrations() { return conversationMigrations; } } });
    expect((await migrator.migrateTo('003_list_order')).error).toBeUndefined();
    await db.insertInto('conversations').values({ id: conversationId, created_at: 1234, last_activity_at: 1234 }).execute();
    await db.insertInto('turns').values({
      id: turnId, conversation_id: conversationId, ordinal: 1, text: '  domanda  ',
      accepted_at: 1234, status: 'pending', answer: null, error: null, finished_at: null,
    }).execute();
    await db.updateTable('installation').set({ active_turn_id: turnId }).where('id', '=', 1).execute();
    await db.destroy();

    const archive = await openConversationArchive(filename, new Date(2345));
    expect(archive.recoveredTurns).toBe(1);
    expect(await archive.db.selectFrom('turns').select(['text', 'status', 'finished_at']).executeTakeFirst())
      .toEqual({ text: '  domanda  ', status: 'interrupted', finished_at: 2345 });
    expect(await archive.db.selectFrom('installation').select(['active_turn_id', 'active_process_id']).executeTakeFirst())
      .toEqual({ active_turn_id: null, active_process_id: null });
    await archive.close();
    const reopened = await openConversationArchive(filename, new Date(3456));
    expect(reopened.recoveredTurns).toBe(0);
    await reopened.close();
  });

  it('keeps a turn owned by another live process pending and rejects a competing turn', async () => {
    const filename = file();
    const first = await openConversationArchive(filename, new Date(1000));
    const firstWriter = new SqliteConversationWrite(first.db);
    expect(await firstWriter.admit({ conversationId, createConversation: true, turn: turn(turnId) }))
      .toMatchObject({ ok: true });
    const child = await liveProcess();
    await first.db.updateTable('installation').set({ active_process_id: child.pid! }).where('id', '=', 1).execute();

    const second = await openConversationArchive(filename, new Date(2345));
    expect(second.recoveredTurns).toBe(0);
    expect(await second.db.selectFrom('turns').select(['status', 'finished_at']).executeTakeFirst())
      .toEqual({ status: 'pending', finished_at: null });
    expect(await new SqliteConversationWrite(second.db).admit({
      conversationId: otherConversationId, createConversation: true, turn: turn(otherTurnId),
    })).toEqual({ ok: false, error: { kind: 'conversation_occupied' } });
    expect(await second.db.selectFrom('turns').selectAll().execute()).toHaveLength(1);
    await second.close();
    child.kill();
    await event(child, 'exit');

    const third = await openConversationArchive(filename, new Date(3456));
    expect(third.recoveredTurns).toBe(1);
    expect(await third.db.selectFrom('turns').select(['status', 'finished_at']).executeTakeFirst())
      .toEqual({ status: 'interrupted', finished_at: 3456 });
    expect(await new SqliteConversationWrite(third.db).admit({
      conversationId: otherConversationId, createConversation: true, turn: turn(otherTurnId),
    })).toMatchObject({ ok: true });
    await third.close();
    await first.close();
  });

  it('fails preparation when a migration fails, before an archive becomes available', async () => {
    const filename = file();
    const sqlite = new Database(filename);
    sqlite.exec('create table conversations (conflicting text)');
    sqlite.close();
    await expect(openConversationArchive(filename, new Date(1000))).rejects.toThrow();
  });
});
