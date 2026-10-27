import { afterEach, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { emptyTestDatabase } from '../../../../../../test/support/test-database.js';
import { createGetConversation } from '../../../application/get-conversation.use-case.js';
import { admitTurn, completeTurn, interruptPendingTurns } from '../../../../test/support/turn-archive.js';
import { openConversationArchive, type ConversationArchive, type ConversationDatabase } from './conversation-archive.js';
import { PostgresTurnRepository } from './postgres-turn-repository.adapter.js';
import { PostgresConversationHistoryRead } from './postgres-conversation-history-read.adapter.js';
import type { TemporaryDatabase } from './temporary-database.js';
import { TurnId } from '../../../domain/identities.js';
import type { TurnAction } from '../../../domain/turn.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const firstTurnId = 'fffffff0-1111-4111-8111-111111111111';
const secondTurnId = '00000001-2222-4222-8222-222222222222';
const opened: ConversationArchive[] = [];
const databases: TemporaryDatabase[] = [];

/** A new empty test database, dropped after the test. */
async function database(): Promise<string> {
  const created = await emptyTestDatabase();
  databases.push(created);
  return created.url;
}

/** Opens and migrates the archive of a test database, as the server does. */
async function openArchive(url: string): Promise<ConversationArchive> {
  const archive = await openConversationArchive(url, () => undefined);
  opened.push(archive);
  return archive;
}

async function open(): Promise<Kysely<ConversationDatabase>> {
  return (await openArchive(await database())).db;
}

async function closeArchive(archive: ConversationArchive): Promise<void> {
  opened.splice(opened.indexOf(archive), 1);
  await archive.close();
}

function accepted(id: string) {
  return ({ id, text: `  ${id}  `, acceptedAt: new Date(1234) });
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map(archive => archive.close()));
  for (const created of databases.splice(0)) await created.drop();
});

describe('conversation history and startup recovery', () => {
  it('reopens two ordered textual exchanges with their answer and public error', async () => {
    const url = await database();
    const archive = await openArchive(url);
    const writer = new PostgresTurnRepository(archive.db);
    const firstText = '  prima   domanda  ';
    const secondText = '  seconda  domanda  ';
    expect(await admitTurn(writer, { conversationId, createConversation: true,
      turn: ({ id: firstTurnId, text: firstText, acceptedAt: new Date(1000) }) }))
      .toEqual({ ok: true, value: undefined });
    expect(await completeTurn(writer, { turnId: firstTurnId,
      outcome: { kind: 'answer', text: 'Prima risposta' }, finishedAt: new Date(2000) }))
      .toMatchObject({ ok: true });
    expect(await admitTurn(writer, { conversationId, createConversation: false,
      turn: ({ id: secondTurnId, text: secondText, acceptedAt: new Date(3000) }) }))
      .toEqual({ ok: true, value: undefined });
    expect(await completeTurn(writer, { turnId: secondTurnId,
      outcome: { kind: 'error', message: 'Errore pubblico' }, finishedAt: new Date(4000) }))
      .toMatchObject({ ok: true });
    const otherConversationId = 'f4d711a3-5e8b-4a9d-a513-23d9ef21521f';
    const otherTurnId = 'bd5458f4-b393-4fb7-8d2a-6465727fbc36';
    expect(await admitTurn(writer, { conversationId: otherConversationId, createConversation: true,
      turn: ({ id: otherTurnId, text: 'altra domanda', acceptedAt: new Date(5000) }) }))
      .toMatchObject({ ok: true });
    expect(await completeTurn(writer, { turnId: otherTurnId,
      outcome: { kind: 'answer', text: 'altra risposta' }, finishedAt: new Date(6000) }))
      .toMatchObject({ ok: true });
    await closeArchive(archive);

    const reopened = (await openArchive(url)).db;
    const history = await createGetConversation(new PostgresConversationHistoryRead(reopened))({ conversationId });
    expect(history).toEqual({ ok: true, value: {
      id: conversationId, createdAt: new Date(1000), lastActivityAt: new Date(3000),
      turns: [
        { id: firstTurnId, text: firstText, acceptedAt: new Date(1000),
          status: 'answered', answer: 'Prima risposta', finishedAt: new Date(2000) },
        { id: secondTurnId, text: secondText, acceptedAt: new Date(3000),
          status: 'failed', error: 'Errore pubblico', finishedAt: new Date(4000) },
      ],
    } });
    expect((await new PostgresConversationHistoryRead(reopened).find(otherConversationId))?.turns)
      .toMatchObject([{ id: otherTurnId, text: 'altra domanda', answer: 'altra risposta' }]);
  });

  // Verification: Prova della continuità dell'agente nella conversazione
  it('stores the responding agent internally and keeps it out of the consultation view', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
    await admitTurn(writer, { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await completeTurn(writer, { turnId: firstTurnId, outcome: { kind: 'answer', text: 'Fatto.', agent: 'home' },
      finishedAt: new Date(2000) });
    await admitTurn(writer, { conversationId, createConversation: false, turn: accepted(secondTurnId) });
    await completeTurn(writer, { turnId: secondTurnId, outcome: { kind: 'answer', text: 'Ciao.' },
      finishedAt: new Date(3000) });
    expect(await db.selectFrom('turns').select(['id', 'agent']).orderBy('ordinal').execute())
      .toEqual([{ id: firstTurnId, agent: 'home' }, { id: secondTurnId, agent: null }]);
    const turns = (await new PostgresConversationHistoryRead(db).find(conversationId))?.turns;
    expect(turns?.map(turn => turn.status === 'answered' ? turn.agent : 'none')).toEqual(['home', undefined]);
    const view = await createGetConversation(new PostgresConversationHistoryRead(db))({ conversationId });
    expect(view.ok && view.value.turns.every(turn => !('agent' in turn))).toBe(true);
    expect(JSON.stringify(view)).not.toContain('home');
  });

  // Verification: Prova della continuità dell'agente nella conversazione
  it('reads a turn without agent and rejects an agent on a turn that is not answered', async () => {
    const db = await open();
    await db.insertInto('conversations').values({ id: conversationId, created_at: new Date(100),
      last_activity_at: new Date(100), active_turn_id: null }).execute();
    await db.insertInto('turns').values({ id: firstTurnId, conversation_id: conversationId, ordinal: 1, text: 'senza agente',
      accepted_at: new Date(100), status: 'answered', answer: 'risposta', error: null, finished_at: new Date(200),
      agent: null, actions: null }).execute();
    const turns = (await new PostgresConversationHistoryRead(db).find(conversationId))?.turns;
    expect(turns).toEqual([{ id: firstTurnId, text: 'senza agente', acceptedAt: new Date(100), status: 'answered',
      answer: 'risposta', finishedAt: new Date(200) }]);
    expect(turns?.[0] && 'agent' in turns[0]).toBe(false);
    await db.updateTable('turns').set({ status: 'failed', answer: null, error: 'errore', agent: 'home' })
      .where('id', '=', firstTurnId).execute();
    await expect(new PostgresConversationHistoryRead(db).find(conversationId)).rejects.toThrow('Invalid persisted turn state');
  });

  // Verification: Prova delle azioni nello storico
  it('stores the actions of the answer internally and keeps them out of the consultation view', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
    const actions: TurnAction[] = [{ tool: 'HassTurnOn', input: { name: 'luce' }, output: { content: [{ type: 'text', text: 'ok' }] } },
      { tool: 'HassTurnOff', input: {}, error: 'Unavailable' }];
    await admitTurn(writer, { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await completeTurn(writer, { turnId: firstTurnId, outcome: { kind: 'answer', text: 'Ho acceso la luce.',
      agent: 'home', actions }, finishedAt: new Date(2000) });
    await admitTurn(writer, { conversationId, createConversation: false, turn: accepted(secondTurnId) });
    await completeTurn(writer, { turnId: secondTurnId, outcome: { kind: 'answer', text: 'Ciao.' },
      finishedAt: new Date(3000) });
    const rows = await db.selectFrom('turns').select(['id', 'actions']).orderBy('ordinal').execute();
    expect(rows.map(row => [row.id, row.actions])).toEqual([[firstTurnId, actions], [secondTurnId, null]]);
    const column = await sql<{ data_type: string }>`select data_type from information_schema.columns
      where table_name = 'turns' and column_name = 'actions'`.execute(db);
    expect(column.rows).toEqual([{ data_type: 'jsonb' }]);
    const turns = (await new PostgresConversationHistoryRead(db).find(conversationId))?.turns;
    expect(turns?.map(turn => turn.status === 'answered' ? turn.actions : 'none')).toEqual([actions, undefined]);
    expect((await writer.find(TurnId.create(firstTurnId)))?.actions).toEqual(actions);
    const view = await createGetConversation(new PostgresConversationHistoryRead(db))({ conversationId });
    expect(view.ok && view.value.turns.every(turn => !('actions' in turn))).toBe(true);
    expect(JSON.stringify(view)).not.toContain('HassTurnOn');
  });

  // Verification: Prova delle azioni nello storico
  it('rejects invalid stored actions', async () => {
    const db = await open();
    await db.insertInto('conversations').values({ id: conversationId, created_at: new Date(100),
      last_activity_at: new Date(100), active_turn_id: null }).execute();
    await db.insertInto('turns').values({ id: firstTurnId, conversation_id: conversationId, ordinal: 1, text: 'domanda',
      accepted_at: new Date(100), status: 'answered', answer: 'risposta', error: null, finished_at: new Date(200),
      agent: 'home', actions: null }).execute();
    const read = new PostgresConversationHistoryRead(db);
    expect((await read.find(conversationId))?.turns).toEqual([{ id: firstTurnId, text: 'domanda', acceptedAt: new Date(100),
      status: 'answered', answer: 'risposta', finishedAt: new Date(200), agent: 'home' }]);
    for (const document of ['null', '{}', '"text"']) {
      await expect(sql`update turns set actions = ${document}::jsonb where id = ${firstTurnId}`.execute(db), document)
        .rejects.toThrow(/turns_actions_array/);
    }
    for (const invalid of ['[]', '[{"tool":"","input":{},"output":1}]',
      '[{"tool":"t","input":[],"output":1}]', '[{"tool":"t","input":{},"output":1,"error":"e"}]',
      '[{"tool":"t","input":{}}]']) {
      await sql`update turns set actions = ${invalid}::jsonb where id = ${firstTurnId}`.execute(db);
      await expect(read.find(conversationId), invalid).rejects.toThrow('Invalid persisted turn state');
    }
    await sql`update turns set status = 'failed', answer = null, error = 'errore', agent = null,
      actions = '[{"tool":"t","input":{},"output":1}]'::jsonb where id = ${firstTurnId}`.execute(db);
    await expect(read.find(conversationId)).rejects.toThrow('Invalid persisted turn state');
  });

  // Verification: Prova della conversione temporale PostgreSQL
  it('stores and restores exact millisecond instants before and after the epoch', async () => {
    const db = await open();
    const writer = new PostgresTurnRepository(db);
    await admitTurn(writer, { conversationId, createConversation: true,
      turn: ({ id: firstTurnId, text: 'prima', acceptedAt: new Date(-1234) }) });
    await completeTurn(writer, { turnId: firstTurnId, outcome: { kind: 'answer', text: 'ok' }, finishedAt: new Date(-12) });
    await admitTurn(writer, { conversationId, createConversation: false,
      turn: ({ id: secondTurnId, text: 'dopo', acceptedAt: new Date(1234) }) });
    await completeTurn(writer, { turnId: secondTurnId, outcome: { kind: 'error', message: 'errore' }, finishedAt: new Date(2345) });

    expect(await db.selectFrom('conversations').select(['created_at', 'last_activity_at']).executeTakeFirst())
      .toEqual({ created_at: new Date(-1234), last_activity_at: new Date(1234) });
    expect(await db.selectFrom('turns').select(['accepted_at', 'finished_at']).orderBy('ordinal').execute())
      .toEqual([{ accepted_at: new Date(-1234), finished_at: new Date(-12) }, { accepted_at: new Date(1234), finished_at: new Date(2345) }]);
    const columns = await sql<{ table_name: string; column_name: string; data_type: string; datetime_precision: number }>`
      select table_name, column_name, data_type, datetime_precision from information_schema.columns
      where table_name in ('conversations', 'turns') and column_name in ('created_at', 'last_activity_at', 'accepted_at', 'finished_at')
      order by table_name, column_name`.execute(db);
    expect(columns.rows.map(row => [row.data_type, row.datetime_precision]))
      .toEqual(Array(4).fill(['timestamp with time zone', 3]));
    const history = await new PostgresConversationHistoryRead(db).find(conversationId);
    expect(history?.createdAt).toEqual(new Date(-1234));
    expect(history?.lastActivityAt).toEqual(new Date(1234));
    expect(history?.turns.map(turn => [turn.acceptedAt, turn.status === 'pending' ? null : turn.finishedAt]))
      .toEqual([[new Date(-1234), new Date(-12)], [new Date(1234), new Date(2345)]]);
  });

  it('preserves turn order, text, outcomes and instants across a database reopen', async () => {
    const url = await database();
    const firstArchive = await openArchive(url);
    const firstDb = firstArchive.db;
    const writer = new PostgresTurnRepository(firstDb);
    await admitTurn(writer, { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await completeTurn(writer, { turnId: firstTurnId, outcome: { kind: 'answer', text: 'Prima risposta' }, finishedAt: new Date(2345) });
    await admitTurn(writer, { conversationId, createConversation: false, turn: accepted(secondTurnId) });
    const pending = await new PostgresConversationHistoryRead(firstDb).find(conversationId);
    expect(pending?.turns.map(turn => turn.status)).toEqual(['answered', 'pending']);
    await closeArchive(firstArchive);

    const reopened = (await openArchive(url)).db;
    expect(await interruptPendingTurns(reopened, new Date(3456))).toBe(1);
    const history = await new PostgresConversationHistoryRead(reopened).find(conversationId);
    expect(history).toMatchObject({
      id: conversationId,
      createdAt: new Date(1234),
      lastActivityAt: new Date(1234),
    });
    expect(history?.turns).toMatchObject([
      { id: firstTurnId, text: `  ${firstTurnId}  `, status: 'answered', answer: 'Prima risposta', acceptedAt: new Date(1234), finishedAt: new Date(2345) },
      { id: secondTurnId, text: `  ${secondTurnId}  `, status: 'interrupted', acceptedAt: new Date(1234), finishedAt: new Date(3456) },
    ]);
    expect(await createGetConversation(new PostgresConversationHistoryRead(reopened))({ conversationId }))
      .toEqual({ ok: true, value: history });
    expect(await createGetConversation(new PostgresConversationHistoryRead(reopened))({ conversationId: 'missing' }))
      .toEqual({ ok: false, error: { kind: 'conversation_not_found' } });
    expect(await interruptPendingTurns(reopened, new Date(4567))).toBe(0);
    expect((await new PostgresConversationHistoryRead(reopened).find(conversationId))?.turns[1])
      .toMatchObject({ finishedAt: new Date(3456), status: 'interrupted' });
    expect(await reopened.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationId).executeTakeFirst())
      .toEqual({ active_turn_id: null });
  });

  it('rolls back recovery if releasing occupancy fails', async () => {
    const db = await open();
    await admitTurn(new PostgresTurnRepository(db), { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await sql.raw(`create function reject_recovery() returns trigger language plpgsql as $$
      begin raise exception 'injected'; end $$`).execute(db);
    await sql.raw(`create trigger reject_recovery before update on conversations for each row
      when (new.active_turn_id is null) execute function reject_recovery()`).execute(db);
    await expect(interruptPendingTurns(db, new Date(3456))).rejects.toThrow();
    expect(await db.selectFrom('turns').select(['status', 'finished_at']).where('id', '=', firstTurnId).executeTakeFirst())
      .toEqual({ status: 'pending', finished_at: null });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationId).executeTakeFirst())
      .toEqual({ active_turn_id: firstTurnId });
  });

  // Verification: Prova della conversione temporale PostgreSQL
  it('rejects infinite historical instants instead of replacing them with the current time', async () => {
    const db = await open();
    await admitTurn(new PostgresTurnRepository(db), { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await sql`update conversations set last_activity_at = 'infinity' where id = ${conversationId}`.execute(db);
    await expect(new PostgresConversationHistoryRead(db).find(conversationId)).rejects.toThrow('Invalid persisted instant');
    await sql`update conversations set last_activity_at = now() where id = ${conversationId}`.execute(db);
    await sql`update turns set accepted_at = '-infinity' where id = ${firstTurnId}`.execute(db);
    await expect(new PostgresConversationHistoryRead(db).find(conversationId)).rejects.toThrow('Invalid persisted instant');
    expect(await new PostgresConversationHistoryRead(db).find('missing')).toBeUndefined();
  });

  it('rejects a gap in the persisted turn positions', async () => {
    const db = await open();
    await admitTurn(new PostgresTurnRepository(db), { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await db.updateTable('turns').set({ ordinal: 2 }).where('id', '=', firstTurnId).execute();
    await expect(new PostgresConversationHistoryRead(db).find(conversationId))
      .rejects.toThrow('Invalid persisted turn order');
  });
});
