import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConversationId, TurnId } from '../../../domain/identities.js';
import { createBeginTurn } from '../../../application/begin-turn.use-case.js';
import { createCompleteTurn } from '../../../application/complete-turn.use-case.js';
import { migrateConversationArchive } from './migrations.js';
import { admitTurn, completeTurn, interruptPendingTurns } from '../../../../test/support/turn-archive.js';
import { SqliteTurnRepository } from './sqlite-turn-repository.adapter.js';
import { SqliteConversationLookup } from './sqlite-conversation-lookup.adapter.js';
import { SqliteConversationHistoryRead } from './sqlite-conversation-history-read.adapter.js';
import { SqliteConversationListRead } from './sqlite-conversation-list-read.adapter.js';
import type { ConversationDatabase } from './schema.js';

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
  return ({ id, acceptedAt: new Date(time), text });
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map(db => db.destroy()));
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('SQLite turn repository', () => {
  it('admits different conversations while one turn remains active and rejects a second turn in the same conversation', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    expect(await admitTurn(writer, { conversationId: conversationA, createConversation: true,
      turn: accepted(turnA, 1000) })).toMatchObject({ ok: true });
    expect(await admitTurn(writer, { conversationId: conversationB, createConversation: true,
      turn: accepted(turnB, 1001) })).toMatchObject({ ok: true });
    expect(await admitTurn(writer, { conversationId: conversationA, createConversation: false,
      turn: accepted('e057302a-1c68-4a99-8dfd-7998e390eb51', 1002) }))
      .toEqual({ ok: false, error: { kind: 'conversation_occupied' } });
    expect(await db.selectFrom('conversations').select(['id', 'active_turn_id']).orderBy('id').execute())
      .toEqual([
        { id: conversationB, active_turn_id: turnB },
        { id: conversationA, active_turn_id: turnA },
      ]);
    expect(await completeTurn(writer, { turnId: turnB, outcome: { kind: 'answer', text: 'B' },
      finishedAt: new Date(2000) })).toMatchObject({ ok: true });
    expect(await db.selectFrom('conversations').select('active_turn_id')
      .where('id', '=', conversationA).executeTakeFirst()).toEqual({ active_turn_id: turnA });
  });

  it('migrates once, rejects a second turn in the same conversation, then releases occupancy', async () => {
    const db = open();
    await migrateConversationArchive(db);
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    expect(await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, -1234) }))
      .toEqual({ ok: true, value: undefined });
    expect(await admitTurn(writer, { conversationId: conversationA, createConversation: false, turn: accepted(turnB, 1235) }))
      .toEqual({ ok: false, error: { kind: 'conversation_occupied' } });
    expect(await db.selectFrom('conversations').selectAll().execute()).toHaveLength(1);
    expect(await db.selectFrom('turns').selectAll().execute()).toHaveLength(1);
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: turnA });

    expect(await completeTurn(writer, { turnId: turnA, outcome: { kind: 'answer', text: 'salve' }, finishedAt: new Date(1234) }))
      .toMatchObject({ ok: true, value: { status: 'answered', answer: 'salve' } });
    expect(await completeTurn(writer, { turnId: turnA, outcome: { kind: 'error', message: 'late' }, finishedAt: new Date(1235) }))
      .toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    expect(await db.selectFrom('turns').select(['accepted_at', 'finished_at', 'status']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ accepted_at: -1234, finished_at: 1234, status: 'answered' });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: null });
    await expect(admitTurn(writer, { conversationId: conversationB, createConversation: true, turn: accepted(turnA, 1235) }))
      .rejects.toThrow();
    expect(await db.selectFrom('conversations').selectAll().execute()).toHaveLength(1);
    expect(await admitTurn(writer, { conversationId: conversationB, createConversation: true, turn: accepted(turnB, 1235) }))
      .toEqual({ ok: true, value: undefined });
  });

  it('checks existing conversations and preserves the supplied acceptance instant and text', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    const lookup = new SqliteConversationLookup(db);
    expect(await lookup.exists(ConversationId.create(conversationA))).toBe(false);
    // Conversations are never removed: a continuation that passed the lookup and finds none is a fault.
    await expect(admitTurn(writer, { conversationId: conversationA, createConversation: false, turn: accepted(turnA, 1234) }))
      .rejects.toThrow('Conversation record missing for admission');
    expect(await db.selectFrom('turns').selectAll().execute()).toHaveLength(0);
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    const row = await db.selectFrom('turns').selectAll().where('id', '=', turnA).executeTakeFirst();
    const conversation = await db.selectFrom('conversations').selectAll().where('id', '=', conversationA).executeTakeFirst();
    expect(await lookup.exists(ConversationId.create(conversationA))).toBe(true);
    expect(row).toMatchObject({ text: '  ciao  ', accepted_at: 1234, status: 'pending' });
    expect(conversation).toMatchObject({ created_at: 1234, last_activity_at: 1234 });
    await completeTurn(writer, { turnId: turnA, outcome: { kind: 'error', message: 'Non disponibile' }, finishedAt: new Date(2345) });
    expect(await admitTurn(writer, { conversationId: conversationA, createConversation: false, turn: accepted(turnB, 5678) }))
      .toEqual({ ok: true, value: undefined });
    expect(await db.selectFrom('conversations').selectAll().where('id', '=', conversationA).executeTakeFirst())
      .toMatchObject({ created_at: 1234, last_activity_at: 5678 });
    expect(await db.selectFrom('turns').select(['status', 'error']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'failed', error: 'Non disponibile' });
  });

  it('rolls back both sides of admission and completion when the second write fails', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    await sql.raw("create trigger reject_turn before insert on turns begin select raise(abort, 'injected'); end").execute(db);
    await expect(admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) }))
      .rejects.toThrow();
    expect(await db.selectFrom('conversations').selectAll().execute()).toHaveLength(0);
    expect(await db.selectFrom('turns').selectAll().execute()).toHaveLength(0);
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toBeUndefined();
    await sql.raw('drop trigger reject_turn').execute(db);
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    await sql.raw("create trigger reject_release before update on conversations when new.active_turn_id is null begin select raise(abort, 'injected'); end").execute(db);
    await expect(completeTurn(writer, { turnId: turnA, outcome: { kind: 'interrupted' }, finishedAt: new Date(5678) }))
      .rejects.toThrow();
    expect(await db.selectFrom('turns').select(['status', 'finished_at']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'pending', finished_at: null });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: turnA });
    await sql.raw('drop trigger reject_release').execute(db);
    expect(await completeTurn(writer, { turnId: turnA, outcome: { kind: 'interrupted' }, finishedAt: new Date(5678) }))
      .toMatchObject({ ok: true, value: { status: 'interrupted' } });
    expect(await completeTurn(writer, { turnId: turnA, outcome: { kind: 'answer', text: 'late' }, finishedAt: new Date(5679) }))
      .toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    expect(await db.selectFrom('turns').select('status').where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'interrupted' });
  });

  it('keeps the turn pending and occupied when releasing after an answer fails', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    expect(await admitTurn(writer, { conversationId: conversationA, createConversation: true,
      turn: accepted(turnA, 1234) })).toMatchObject({ ok: true });
    await sql.raw("create trigger reject_answer_release before update on conversations when new.active_turn_id is null begin select raise(abort, 'injected'); end").execute(db);
    await expect(completeTurn(writer, { turnId: turnA,
      outcome: { kind: 'answer', text: 'risposta' }, finishedAt: new Date(2345) }))
      .rejects.toThrow();
    expect(await db.selectFrom('turns').select(['status', 'answer', 'finished_at'])
      .where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'pending', answer: null, finished_at: null });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: turnA });
    await sql.raw('drop trigger reject_answer_release').execute(db);
    expect(await completeTurn(writer, { turnId: turnA,
      outcome: { kind: 'answer', text: 'risposta' }, finishedAt: new Date(2345) }))
      .toMatchObject({ ok: true, value: { status: 'answered', answer: 'risposta' } });
    expect(await db.selectFrom('turns').select(['status', 'answer', 'finished_at'])
      .where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'answered', answer: 'risposta', finished_at: 2345 });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: null });
  });

  it('admits at most one turn across separate SQLite connections', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ambrogio-conversations-'));
    directories.push(directory);
    const file = join(directory, 'conversation.sqlite');
    const firstDb = open(file);
    await migrateConversationArchive(firstDb);
    const secondDb = open(file);
    const results = await Promise.all([
      admitTurn(new SqliteTurnRepository(firstDb), { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1000) }),
      admitTurn(new SqliteTurnRepository(secondDb), { conversationId: conversationB, createConversation: true, turn: accepted(turnB, 1001) }),
    ]);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(results.filter(result => !result.ok)).toEqual([{ ok: false, error: { kind: 'archive_busy' } }]);
    expect(await firstDb.selectFrom('turns').selectAll().execute()).toHaveLength(1);
  });

  it('runs the Application admission and completion flow against a real archive', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const archive = new SqliteTurnRepository(db);
    const ids = [conversationA, turnA, conversationB, turnB];
    const clock = { now: () => new Date(2345) };
    const begin = createBeginTurn({ turns: archive, conversations: new SqliteConversationLookup(db),
      identifiers: { next: () => ids.shift()! }, clock });
    const complete = createCompleteTurn({ turns: archive, clock });
    expect(await begin({ text: '  buongiorno  ' })).toMatchObject({
      ok: true, value: { conversationId: conversationA, turnId: turnA },
    });
    expect(await begin({ text: 'secondo turno', conversationId: conversationA })).toEqual({ ok: false, error: { kind: 'occupied' } });
    expect(await complete({ turnId: turnA, outcome: { kind: 'answer', text: 'ciao' } })).toEqual({
      ok: true, value: { turnId: turnA, status: 'answered' },
    });
    expect(await db.selectFrom('turns').select(['text', 'answer', 'status']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ text: '  buongiorno  ', answer: 'ciao', status: 'answered' });
  });

  it('preserves supplied identities and acceptance times across reopen, and rejects a duplicate identity', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ambrogio-identities-time-'));
    directories.push(directory);
    const filename = join(directory, 'archive.sqlite');
    const firstDb = open(filename);
    await migrateConversationArchive(firstDb);
    const writer = new SqliteTurnRepository(firstDb);
    const generated = [conversationA, turnA, conversationB, turnB, conversationA, 'e057302a-1c68-4a99-8dfd-7998e390eb51'];
    const instants = [1000, 2000, 3000];
    const begin = createBeginTurn({ turns: writer, conversations: new SqliteConversationLookup(firstDb),
      identifiers: { next: () => generated.shift()! },
      clock: { now: () => new Date(instants.shift()!) },
    });
    const complete = createCompleteTurn({ turns: writer, clock: { now: () => new Date(9000) } });

    expect(await begin({ text: 'prima' })).toMatchObject({
      ok: true, value: { conversationId: conversationA, turnId: turnA, acceptedAt: new Date(1000) },
    });
    expect(await complete({ turnId: turnA, outcome: { kind: 'answer', text: 'ok' } }))
      .toMatchObject({ ok: true });
    expect(await begin({ text: 'seconda' })).toMatchObject({
      ok: true, value: { conversationId: conversationB, turnId: turnB, acceptedAt: new Date(2000) },
    });
    expect(await complete({ turnId: turnB, outcome: { kind: 'answer', text: 'ok' } }))
      .toMatchObject({ ok: true });

    await expect(begin({ text: 'duplicata' })).rejects.toThrow();
    expect(await firstDb.selectFrom('conversations').select(['id', 'created_at', 'last_activity_at'])
      .orderBy('id').execute()).toEqual([
        { id: conversationB, created_at: 2000, last_activity_at: 2000 },
        { id: conversationA, created_at: 1000, last_activity_at: 1000 },
      ]);
    expect(await firstDb.selectFrom('turns').select('id').execute()).toHaveLength(2);
    await firstDb.destroy();
    opened.splice(opened.indexOf(firstDb), 1);

    const reopened = open(filename);
    await migrateConversationArchive(reopened);
    expect(await interruptPendingTurns(reopened, new Date(10000))).toBe(0);
    const history = new SqliteConversationHistoryRead(reopened);
    expect(await history.find(conversationA)).toMatchObject({
      id: conversationA, createdAt: new Date(1000), lastActivityAt: new Date(1000),
      turns: [{ id: turnA, acceptedAt: new Date(1000) }],
    });
    expect(await history.find(conversationB)).toMatchObject({
      id: conversationB, createdAt: new Date(2000), lastActivityAt: new Date(2000),
      turns: [{ id: turnB, acceptedAt: new Date(2000) }],
    });
    expect((await new SqliteConversationListRead(reopened).page(undefined, 10)).items)
      .toEqual([{ id: conversationB, lastActivityAt: new Date(2000) },
        { id: conversationA, lastActivityAt: new Date(1000) }]);
  });

  it('rejects an invalid stored instant without changing a pending turn', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    await sql.raw(`update turns set accepted_at = 'bad' where id = '${turnA}'`).execute(db);
    await expect(completeTurn(writer, { turnId: turnA, outcome: { kind: 'answer', text: 'ciao' }, finishedAt: new Date(5678) }))
      .rejects.toThrow('Invalid persisted instant');
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: turnA });
    expect(await db.selectFrom('turns').select('status').where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'pending' });
  });

  it('refuses a conclusion of a turn that another writer closed after it was loaded', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1000) });
    const first = (await writer.find(TurnId.create(turnA)))!;
    const second = (await writer.find(TurnId.create(turnA)))!;
    expect(first.answer('salve', new Date(2000)).ok).toBe(true);
    expect(await writer.saveConclusion(first)).toEqual({ ok: true, value: undefined });
    expect(second.interrupt(new Date(3000)).ok).toBe(true);
    expect(await writer.saveConclusion(second)).toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    expect(await db.selectFrom('turns').select(['status', 'answer', 'finished_at']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'answered', answer: 'salve', finished_at: 2000 });
    await expect(writer.saveConclusion((await writer.find(TurnId.create(turnA)))!)).resolves
      .toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    const pending = (await writer.find(TurnId.create(turnA)))!;
    expect(pending.status).toBe('answered');
  });

  // Verification: Prova del caricamento completo del turno
  it('loads complete turns, reports an absent identity and fails on missing, duplicated or unrelated records', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1000) });
    await admitTurn(writer, { conversationId: conversationB, createConversation: true, turn: accepted(turnB, 1001) });
    await completeTurn(writer, { turnId: turnB, outcome: { kind: 'answer', text: 'B', agent: 'home' }, finishedAt: new Date(2000) });

    expect(await writer.find(TurnId.create('e057302a-1c68-4a99-8dfd-7998e390eb51'))).toBeUndefined();
    const pending = (await writer.find(TurnId.create(turnA)))!;
    expect([pending.id.value, pending.conversationId.value, pending.text, pending.acceptedAt, pending.status])
      .toEqual([turnA, conversationA, '  ciao  ', new Date(1000), 'pending']);
    const answered = (await writer.find(TurnId.create(turnB)))!;
    expect([answered.status, answered.answerText, answered.respondingAgent, answered.finishedAt])
      .toEqual(['answered', 'B', 'home', new Date(2000)]);
    expect((await writer.findPending()).map(turn => turn.id.value)).toEqual([turnA]);

    const corrupt = async (statement: string, target: string, message: string, stillPending = target === turnA) => {
      await sql.raw('begin').execute(db);
      try {
        await sql.raw(statement).execute(db);
        await expect(writer.find(TurnId.create(target))).rejects.toThrow(message);
        if (stillPending) await expect(writer.findPending()).rejects.toThrow(message);
      } finally { await sql.raw('rollback').execute(db); }
    };
    // A pending turn without the occupancy of its conversation.
    await corrupt(`update conversations set active_turn_id = null where id = '${conversationA}'`, turnA,
      'Inconsistent conversation occupancy');
    // A pending turn whose occupancy is duplicated in another conversation.
    await corrupt(`update conversations set active_turn_id = '${turnA}' where id = '${conversationB}'`, turnA,
      'Inconsistent conversation occupancy');
    // A concluded turn that still occupies its conversation.
    await corrupt(`update conversations set active_turn_id = '${turnB}' where id = '${conversationB}'`, turnB,
      'Inconsistent conversation occupancy');
    // Values incompatible with the current model are not repaired.
    await corrupt(`update turns set status = 'unknown' where id = '${turnA}'`, turnA, 'Invalid persisted turn state', false);
    await corrupt(`update turns set accepted_at = 'bad' where id = '${turnA}'`, turnA, 'Invalid persisted instant');

    // A turn without its conversation, written with the foreign keys disabled.
    await sql.raw('pragma foreign_keys = off').execute(db);
    await sql.raw(`update turns set conversation_id = '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}' where id = '${turnB}'`).execute(db);
    await expect(writer.find(TurnId.create(turnB))).rejects.toThrow('Conversation record missing for turn');
    await sql.raw('pragma foreign_keys = on').execute(db);
    expect((await writer.find(TurnId.create(turnA)))!.status).toBe('pending');
  });
});
