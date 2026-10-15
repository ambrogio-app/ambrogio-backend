import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Turn } from '../../../src/domain/turn.js';
import { createBeginTurn } from '../../../src/application/begin-turn.use-case.js';
import { createCompleteTurn } from '../../../src/application/complete-turn.use-case.js';
import { migrateConversationArchive } from '../../../src/adapters/out/sqlite/migrations.js';
import { SqliteConversationWrite } from '../../../src/adapters/out/sqlite/sqlite-conversation-write.js';
import type { ConversationDatabase } from '../../../src/adapters/out/sqlite/schema.js';

const conversationA = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const conversationB = 'ab02e7da-7a10-4585-8b09-ab8f6b4b93ee';
const turnA = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
const turnB = '82d590bb-216d-407d-8034-55f1db4a3212';

const opened: Kysely<ConversationDatabase>[] = [];
const directories: string[] = [];

function open(filename = ':memory:') {
  const sqlite = new Database(filename);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 1000');
  const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
  opened.push(db);
  return db;
}

function accepted(id: string, time: number, text = '  ciao  ') {
  return Turn.accept({ id, acceptedAt: new Date(time), text });
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map(db => db.destroy()));
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('SQLite conversation writer', () => {
  it('migrates once, admits one turn, rejects rather than queues another, then releases occupancy', async () => {
    const db = open();
    await migrateConversationArchive(db);
    await migrateConversationArchive(db);
    const writer = new SqliteConversationWrite(db);
    expect(await writer.admit({ conversationId: conversationA, createConversation: true, turn: accepted(turnA, -1234) }))
      .toEqual({ ok: true, value: undefined });
    expect(await writer.admit({ conversationId: conversationB, createConversation: true, turn: accepted(turnB, 1235) }))
      .toEqual({ ok: false, error: { kind: 'conversation_occupied' } });
    expect(await db.selectFrom('conversations').selectAll().execute()).toHaveLength(1);
    expect(await db.selectFrom('turns').selectAll().execute()).toHaveLength(1);
    expect(await db.selectFrom('installation').select('active_turn_id').executeTakeFirst())
      .toEqual({ active_turn_id: turnA });

    expect(await writer.complete({ turnId: turnA, outcome: { kind: 'answer', text: 'salve' }, finishedAt: new Date(1234) }))
      .toMatchObject({ ok: true, value: { status: 'answered', answer: 'salve' } });
    expect(await writer.complete({ turnId: turnA, outcome: { kind: 'error', message: 'late' }, finishedAt: new Date(1235) }))
      .toEqual({ ok: false, error: { kind: 'turn_not_active' } });
    expect(await db.selectFrom('turns').select(['accepted_at', 'finished_at', 'status']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ accepted_at: -1234, finished_at: 1234, status: 'answered' });
    expect(await db.selectFrom('installation').select('active_turn_id').executeTakeFirst())
      .toEqual({ active_turn_id: null });
    await expect(writer.admit({ conversationId: conversationB, createConversation: true, turn: accepted(turnA, 1235) }))
      .rejects.toThrow();
    expect(await db.selectFrom('conversations').selectAll().execute()).toHaveLength(1);
    expect(await writer.admit({ conversationId: conversationB, createConversation: true, turn: accepted(turnB, 1235) }))
      .toEqual({ ok: true, value: undefined });
  });

  it('checks existing conversations and preserves the supplied acceptance instant and text', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteConversationWrite(db);
    expect(await writer.admit({ conversationId: conversationA, createConversation: false, turn: accepted(turnA, 1234) }))
      .toEqual({ ok: false, error: { kind: 'conversation_missing' } });
    expect(await db.selectFrom('turns').selectAll().execute()).toHaveLength(0);
    await writer.admit({ conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    const row = await db.selectFrom('turns').selectAll().where('id', '=', turnA).executeTakeFirst();
    const conversation = await db.selectFrom('conversations').selectAll().where('id', '=', conversationA).executeTakeFirst();
    expect(row).toMatchObject({ text: '  ciao  ', accepted_at: 1234, status: 'pending' });
    expect(conversation).toMatchObject({ created_at: 1234, last_activity_at: 1234 });
    await writer.complete({ turnId: turnA, outcome: { kind: 'error', message: 'Non disponibile' }, finishedAt: new Date(2345) });
    expect(await writer.admit({ conversationId: conversationA, createConversation: false, turn: accepted(turnB, 5678) }))
      .toEqual({ ok: true, value: undefined });
    expect(await db.selectFrom('conversations').selectAll().where('id', '=', conversationA).executeTakeFirst())
      .toMatchObject({ created_at: 1234, last_activity_at: 5678 });
    expect(await db.selectFrom('turns').select(['status', 'error']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'failed', error: 'Non disponibile' });
  });

  it('rolls back both sides of admission and completion when the second write fails', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteConversationWrite(db);
    await sql.raw("create trigger reject_turn before insert on turns begin select raise(abort, 'injected'); end").execute(db);
    await expect(writer.admit({ conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) }))
      .rejects.toThrow();
    expect(await db.selectFrom('conversations').selectAll().execute()).toHaveLength(0);
    await sql.raw('drop trigger reject_turn').execute(db);
    await writer.admit({ conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    await sql.raw("create trigger reject_release before update on installation when new.active_turn_id is null begin select raise(abort, 'injected'); end").execute(db);
    await expect(writer.complete({ turnId: turnA, outcome: { kind: 'interrupted' }, finishedAt: new Date(5678) }))
      .rejects.toThrow();
    expect(await db.selectFrom('turns').select(['status', 'finished_at']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'pending', finished_at: null });
    expect(await db.selectFrom('installation').select('active_turn_id').executeTakeFirst())
      .toEqual({ active_turn_id: turnA });
    await sql.raw('drop trigger reject_release').execute(db);
    expect(await writer.complete({ turnId: turnA, outcome: { kind: 'interrupted' }, finishedAt: new Date(5678) }))
      .toMatchObject({ ok: true, value: { status: 'interrupted' } });
    expect(await writer.complete({ turnId: turnA, outcome: { kind: 'answer', text: 'late' }, finishedAt: new Date(5679) }))
      .toEqual({ ok: false, error: { kind: 'turn_not_active' } });
    expect(await db.selectFrom('turns').select('status').where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'interrupted' });
  });

  it('admits at most one turn across separate SQLite connections', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ambrogio-conversations-'));
    directories.push(directory);
    const file = join(directory, 'conversation.sqlite');
    const firstDb = open(file);
    await migrateConversationArchive(firstDb);
    const secondDb = open(file);
    const results = await Promise.all([
      new SqliteConversationWrite(firstDb).admit({ conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1000) }),
      new SqliteConversationWrite(secondDb).admit({ conversationId: conversationB, createConversation: true, turn: accepted(turnB, 1001) }),
    ]);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(results.filter(result => !result.ok)).toEqual([{ ok: false, error: { kind: 'archive_busy' } }]);
    expect(await firstDb.selectFrom('turns').selectAll().execute()).toHaveLength(1);
  });

  it('runs the Application admission and completion flow against a real archive', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const archive = new SqliteConversationWrite(db);
    const ids = [conversationA, turnA, conversationB, turnB];
    const clock = { now: () => new Date(2345) };
    const begin = createBeginTurn({ archive, identifiers: { next: () => ids.shift()! }, clock });
    const complete = createCompleteTurn({ archive, clock });
    expect(await begin({ text: '  buongiorno  ' })).toMatchObject({
      ok: true, value: { conversationId: conversationA, turnId: turnA },
    });
    expect(await begin({ text: 'secondo turno' })).toEqual({ ok: false, error: { kind: 'occupied' } });
    expect(await complete({ turnId: turnA, outcome: { kind: 'answer', text: 'ciao' } })).toEqual({
      ok: true, value: { turnId: turnA, status: 'answered' },
    });
    expect(await db.selectFrom('turns').select(['text', 'answer', 'status']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ text: '  buongiorno  ', answer: 'ciao', status: 'answered' });
  });

  it('rejects an invalid stored instant without changing a pending turn', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteConversationWrite(db);
    await writer.admit({ conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    await sql.raw(`update turns set accepted_at = 'bad' where id = '${turnA}'`).execute(db);
    await expect(writer.complete({ turnId: turnA, outcome: { kind: 'answer', text: 'ciao' }, finishedAt: new Date(5678) }))
      .rejects.toThrow('Invalid persisted instant');
    expect(await db.selectFrom('installation').select('active_turn_id').executeTakeFirst())
      .toEqual({ active_turn_id: turnA });
    expect(await db.selectFrom('turns').select('status').where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'pending' });
  });
});
