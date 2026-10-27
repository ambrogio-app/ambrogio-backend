import { afterEach, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { emptyTestDatabase } from '../../../../../../test/support/test-database.js';
import { ConversationId, TurnId } from '../../../domain/identities.js';
import { createBeginTurn } from '../../../application/begin-turn.use-case.js';
import { createCompleteTurn } from '../../../application/complete-turn.use-case.js';
import { admitTurn, completeTurn, interruptPendingTurns } from '../../../../test/support/turn-archive.js';
import { PostgresTurnRepository } from './postgres-turn-repository.adapter.js';
import { PostgresConversationLookup } from './postgres-conversation-lookup.adapter.js';
import { PostgresConversationHistoryRead } from './postgres-conversation-history-read.adapter.js';
import { PostgresConversationListRead } from './postgres-conversation-list-read.adapter.js';
import { migrateConversationArchive } from './migrations.js';
import { openConversationArchive, type ConversationArchive, type ConversationDatabase } from './conversation-archive.js';
import type { TemporaryDatabase } from './temporary-database.js';

const conversationA = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const conversationB = 'ab02e7da-7a10-4585-8b09-ab8f6b4b93ee';
const turnA = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
const turnB = '82d590bb-216d-407d-8034-55f1db4a3212';

const opened: ConversationArchive[] = [];
const databases: TemporaryDatabase[] = [];

/** A new empty test database, dropped after the test. */
async function database(): Promise<string> {
  const created = await emptyTestDatabase();
  databases.push(created);
  return created.url;
}

/** Opens and migrates the archive of a test database, as the server does, with its own pool. */
async function open(url?: string): Promise<Kysely<ConversationDatabase>> {
  const archive = await openConversationArchive(url ?? await database(), () => undefined);
  opened.push(archive);
  return archive.db;
}

async function close(db: Kysely<ConversationDatabase>): Promise<void> {
  const archive = opened.find(candidate => candidate.db === db)!;
  opened.splice(opened.indexOf(archive), 1);
  await archive.close();
}

/** A trigger that fails the matching write, as an injected fault. */
async function rejectWrites(db: Kysely<ConversationDatabase>, name: string, table: string, when: string): Promise<void> {
  await sql.raw(`create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'injected'; end $$`).execute(db);
  await sql.raw(`create trigger ${name} before ${table} for each row ${when} execute function ${name}()`).execute(db);
}

async function allowWrites(db: Kysely<ConversationDatabase>, name: string, table: string): Promise<void> {
  await sql.raw(`drop trigger ${name} on ${table}`).execute(db);
  await sql.raw(`drop function ${name}()`).execute(db);
}

function accepted(id: string, time: number, text = '  ciao  ') {
  return ({ id, acceptedAt: new Date(time), text });
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map(archive => archive.close()));
  for (const created of databases.splice(0)) await created.drop();
});

describe('PostgreSQL turn repository', () => {
  it('admits different conversations while one turn remains active and rejects a second turn in the same conversation', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
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
    const db = await open();
    // Opening the archive applied the migrations: applying them again changes nothing.
    await migrateConversationArchive(db);
    const writer = new PostgresTurnRepository(db);
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
      .toEqual({ accepted_at: new Date(-1234), finished_at: new Date(1234), status: 'answered' });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: null });
    await expect(admitTurn(writer, { conversationId: conversationB, createConversation: true, turn: accepted(turnA, 1235) }))
      .rejects.toThrow();
    expect(await db.selectFrom('conversations').selectAll().execute()).toHaveLength(1);
    expect(await admitTurn(writer, { conversationId: conversationB, createConversation: true, turn: accepted(turnB, 1235) }))
      .toEqual({ ok: true, value: undefined });
  });

  it('checks existing conversations and preserves the supplied acceptance instant and text', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
    const lookup = new PostgresConversationLookup(db);
    expect(await lookup.exists(ConversationId.create(conversationA))).toBe(false);
    // Conversations are never removed: a continuation that passed the lookup and finds none is a fault.
    await expect(admitTurn(writer, { conversationId: conversationA, createConversation: false, turn: accepted(turnA, 1234) }))
      .rejects.toThrow('Conversation record missing for admission');
    expect(await db.selectFrom('turns').selectAll().execute()).toHaveLength(0);
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    const row = await db.selectFrom('turns').selectAll().where('id', '=', turnA).executeTakeFirst();
    const conversation = await db.selectFrom('conversations').selectAll().where('id', '=', conversationA).executeTakeFirst();
    expect(await lookup.exists(ConversationId.create(conversationA))).toBe(true);
    expect(row).toMatchObject({ text: '  ciao  ', accepted_at: new Date(1234), status: 'pending' });
    expect(conversation).toMatchObject({ created_at: new Date(1234), last_activity_at: new Date(1234) });
    await completeTurn(writer, { turnId: turnA, outcome: { kind: 'error', message: 'Non disponibile' }, finishedAt: new Date(2345) });
    expect(await admitTurn(writer, { conversationId: conversationA, createConversation: false, turn: accepted(turnB, 5678) }))
      .toEqual({ ok: true, value: undefined });
    expect(await db.selectFrom('conversations').selectAll().where('id', '=', conversationA).executeTakeFirst())
      .toMatchObject({ created_at: new Date(1234), last_activity_at: new Date(5678) });
    expect(await db.selectFrom('turns').select(['status', 'error']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'failed', error: 'Non disponibile' });
  });

  it('rolls back both sides of admission and completion when the second write fails', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
    await rejectWrites(db, 'reject_turn', 'insert on turns', '');
    await expect(admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) }))
      .rejects.toThrow();
    expect(await db.selectFrom('conversations').selectAll().execute()).toHaveLength(0);
    expect(await db.selectFrom('turns').selectAll().execute()).toHaveLength(0);
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toBeUndefined();
    await allowWrites(db, 'reject_turn', 'turns');
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    await rejectWrites(db, 'reject_release', 'update on conversations', 'when (new.active_turn_id is null)');
    await expect(completeTurn(writer, { turnId: turnA, outcome: { kind: 'interrupted' }, finishedAt: new Date(5678) }))
      .rejects.toThrow();
    expect(await db.selectFrom('turns').select(['status', 'finished_at']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'pending', finished_at: null });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: turnA });
    await allowWrites(db, 'reject_release', 'conversations');
    expect(await completeTurn(writer, { turnId: turnA, outcome: { kind: 'interrupted' }, finishedAt: new Date(5678) }))
      .toMatchObject({ ok: true, value: { status: 'interrupted' } });
    expect(await completeTurn(writer, { turnId: turnA, outcome: { kind: 'answer', text: 'late' }, finishedAt: new Date(5679) }))
      .toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    expect(await db.selectFrom('turns').select('status').where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'interrupted' });
  });

  it('keeps the turn pending and occupied when releasing after an answer fails', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
    expect(await admitTurn(writer, { conversationId: conversationA, createConversation: true,
      turn: accepted(turnA, 1234) })).toMatchObject({ ok: true });
    await rejectWrites(db, 'reject_answer_release', 'update on conversations', 'when (new.active_turn_id is null)');
    await expect(completeTurn(writer, { turnId: turnA,
      outcome: { kind: 'answer', text: 'risposta' }, finishedAt: new Date(2345) }))
      .rejects.toThrow();
    expect(await db.selectFrom('turns').select(['status', 'answer', 'finished_at'])
      .where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'pending', answer: null, finished_at: null });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: turnA });
    await allowWrites(db, 'reject_answer_release', 'conversations');
    expect(await completeTurn(writer, { turnId: turnA,
      outcome: { kind: 'answer', text: 'risposta' }, finishedAt: new Date(2345) }))
      .toMatchObject({ ok: true, value: { status: 'answered', answer: 'risposta' } });
    expect(await db.selectFrom('turns').select(['status', 'answer', 'finished_at'])
      .where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'answered', answer: 'risposta', finished_at: new Date(2345) });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: null });
  });

  it('admits turns of different conversations in parallel across separate pools', async () => {
    const url = await database();
    const firstDb = await open(url);
    const secondDb = await open(url);
    const results = await Promise.all([
      admitTurn(new PostgresTurnRepository(firstDb), { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1000) }),
      admitTurn(new PostgresTurnRepository(secondDb), { conversationId: conversationB, createConversation: true, turn: accepted(turnB, 1001) }),
    ]);
    expect(results).toEqual([{ ok: true, value: undefined }, { ok: true, value: undefined }]);
    expect(await firstDb.selectFrom('turns').selectAll().execute()).toHaveLength(2);
  });

  it('runs the Application admission and completion flow against a real archive', async () => {
    const db = await open();
    const archive = new PostgresTurnRepository(db);
    const ids = [conversationA, turnA, conversationB, turnB];
    const clock = { now: () => new Date(2345) };
    const begin = createBeginTurn({ turns: archive, conversations: new PostgresConversationLookup(db),
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
    const url = await database();
    const firstDb = await open(url);
    const writer = new PostgresTurnRepository(firstDb);
    const generated = [conversationA, turnA, conversationB, turnB, conversationA, 'e057302a-1c68-4a99-8dfd-7998e390eb51'];
    const instants = [1000, 2000, 3000];
    const begin = createBeginTurn({ turns: writer, conversations: new PostgresConversationLookup(firstDb),
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
        { id: conversationB, created_at: new Date(2000), last_activity_at: new Date(2000) },
        { id: conversationA, created_at: new Date(1000), last_activity_at: new Date(1000) },
      ]);
    expect(await firstDb.selectFrom('turns').select('id').execute()).toHaveLength(2);
    await close(firstDb);

    const reopened = await open(url);
    expect(await interruptPendingTurns(reopened, new Date(10000))).toBe(0);
    const history = new PostgresConversationHistoryRead(reopened);
    expect(await history.find(conversationA)).toMatchObject({
      id: conversationA, createdAt: new Date(1000), lastActivityAt: new Date(1000),
      turns: [{ id: turnA, acceptedAt: new Date(1000) }],
    });
    expect(await history.find(conversationB)).toMatchObject({
      id: conversationB, createdAt: new Date(2000), lastActivityAt: new Date(2000),
      turns: [{ id: turnB, acceptedAt: new Date(2000) }],
    });
    expect((await new PostgresConversationListRead(reopened).page(undefined, 10)).items)
      .toEqual([{ id: conversationB, lastActivityAt: new Date(2000) },
        { id: conversationA, lastActivityAt: new Date(1000) }]);
  });

  it('rejects an invalid stored instant without changing a pending turn', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1234) });
    await sql`update turns set accepted_at = 'infinity' where id = ${turnA}`.execute(db);
    await expect(completeTurn(writer, { turnId: turnA, outcome: { kind: 'answer', text: 'ciao' }, finishedAt: new Date(5678) }))
      .rejects.toThrow('Invalid persisted instant');
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationA).executeTakeFirst())
      .toEqual({ active_turn_id: turnA });
    expect(await db.selectFrom('turns').select('status').where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'pending' });
  });

  it('refuses a conclusion of a turn that another writer closed after it was loaded', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
    await admitTurn(writer, { conversationId: conversationA, createConversation: true, turn: accepted(turnA, 1000) });
    const first = (await writer.find(TurnId.create(turnA)))!;
    const second = (await writer.find(TurnId.create(turnA)))!;
    expect(first.answer('salve', new Date(2000)).ok).toBe(true);
    expect(await writer.saveConclusion(first)).toEqual({ ok: true, value: undefined });
    expect(second.interrupt(new Date(3000)).ok).toBe(true);
    expect(await writer.saveConclusion(second)).toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    expect(await db.selectFrom('turns').select(['status', 'answer', 'finished_at']).where('id', '=', turnA).executeTakeFirst())
      .toEqual({ status: 'answered', answer: 'salve', finished_at: new Date(2000) });
    await expect(writer.saveConclusion((await writer.find(TurnId.create(turnA)))!)).resolves
      .toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    const pending = (await writer.find(TurnId.create(turnA)))!;
    expect(pending.status).toBe('answered');
  });

  // Verification: Prova del caricamento completo del turno
  it('loads complete turns, reports an absent identity and fails on missing, duplicated or unrelated records', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
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

    // Each corruption is committed, observed through the repository and then reverted.
    const corrupt = async (statement: string, revert: string, target: string, message: string,
      stillPending = target === turnA) => {
      await sql.raw(statement).execute(db);
      try {
        await expect(writer.find(TurnId.create(target))).rejects.toThrow(message);
        if (stillPending) await expect(writer.findPending()).rejects.toThrow(message);
      } finally { await sql.raw(revert).execute(db); }
    };
    // A pending turn without the occupancy of its conversation.
    await corrupt(`update conversations set active_turn_id = null where id = '${conversationA}'`,
      `update conversations set active_turn_id = '${turnA}' where id = '${conversationA}'`, turnA,
      'Inconsistent conversation occupancy');
    // A pending turn whose occupancy is duplicated in another conversation.
    await corrupt(`update conversations set active_turn_id = '${turnA}' where id = '${conversationB}'`,
      `update conversations set active_turn_id = null where id = '${conversationB}'`, turnA,
      'Inconsistent conversation occupancy');
    // A concluded turn that still occupies its conversation.
    await corrupt(`update conversations set active_turn_id = '${turnB}' where id = '${conversationB}'`,
      `update conversations set active_turn_id = null where id = '${conversationB}'`, turnB,
      'Inconsistent conversation occupancy');
    // Values incompatible with the current model are not repaired.
    await corrupt(`update turns set status = 'unknown' where id = '${turnA}'`,
      `update turns set status = 'pending' where id = '${turnA}'`, turnA, 'Invalid persisted turn state', false);
    await corrupt(`update turns set accepted_at = 'infinity' where id = '${turnA}'`,
      `update turns set accepted_at = '1970-01-01T00:00:01Z' where id = '${turnA}'`, turnA, 'Invalid persisted instant');

    // A turn without its conversation, written without the foreign key of the test database.
    await sql.raw('alter table turns drop constraint turns_conversation_id_fkey').execute(db);
    await sql.raw(`update turns set conversation_id = '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}' where id = '${turnB}'`).execute(db);
    await expect(writer.find(TurnId.create(turnB))).rejects.toThrow('Conversation record missing for turn');
    expect((await writer.find(TurnId.create(turnA)))!.status).toBe('pending');
  });
});
