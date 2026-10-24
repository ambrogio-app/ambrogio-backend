import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGetConversation } from '../../../application/get-conversation.use-case.js';
import { admitTurn, completeTurn, interruptPendingTurns } from '../../../../test/support/turn-archive.js';
import { conversationMigrations, migrateConversationArchive } from './migrations.js';
import { SqliteTurnRepository } from './sqlite-turn-repository.adapter.js';
import { SqliteConversationHistoryRead } from './sqlite-conversation-history-read.adapter.js';
import type { ConversationDatabase } from './schema.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const firstTurnId = 'fffffff0-1111-4111-8111-111111111111';
const secondTurnId = '00000001-2222-4222-8222-222222222222';
const opened: Kysely<ConversationDatabase>[] = [];
const directories: string[] = [];

function open(filename: string) {
  const sqlite = new Database(filename);
  sqlite.pragma('foreign_keys = ON');
  const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
  opened.push(db);
  return db;
}

function accepted(id: string) {
  return ({ id, text: `  ${id}  `, acceptedAt: new Date(1234) });
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map(db => db.destroy()));
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('conversation history and startup recovery', () => {
  it('reopens two ordered textual exchanges with their answer and public error', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ambrogio-exchanges-'));
    directories.push(directory);
    const filename = join(directory, 'history.sqlite');
    const db = open(filename);
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
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
    await db.destroy();
    opened.splice(opened.indexOf(db), 1);

    const reopened = open(filename);
    await migrateConversationArchive(reopened);
    const history = await createGetConversation(new SqliteConversationHistoryRead(reopened))({ conversationId });
    expect(history).toEqual({ ok: true, value: {
      id: conversationId, createdAt: new Date(1000), lastActivityAt: new Date(3000),
      turns: [
        { id: firstTurnId, text: firstText, acceptedAt: new Date(1000),
          status: 'answered', answer: 'Prima risposta', finishedAt: new Date(2000) },
        { id: secondTurnId, text: secondText, acceptedAt: new Date(3000),
          status: 'failed', error: 'Errore pubblico', finishedAt: new Date(4000) },
      ],
    } });
    expect((await new SqliteConversationHistoryRead(reopened).find(otherConversationId))?.turns)
      .toMatchObject([{ id: otherTurnId, text: 'altra domanda', answer: 'altra risposta' }]);
  });

  // Verification: Prova della continuità dell'agente nella conversazione
  it('stores the responding agent internally and keeps it out of the consultation view', async () => {
    const db = open(':memory:');
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    await admitTurn(writer, { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await completeTurn(writer, { turnId: firstTurnId, outcome: { kind: 'answer', text: 'Fatto.', agent: 'home' },
      finishedAt: new Date(2000) });
    await admitTurn(writer, { conversationId, createConversation: false, turn: accepted(secondTurnId) });
    await completeTurn(writer, { turnId: secondTurnId, outcome: { kind: 'answer', text: 'Ciao.' },
      finishedAt: new Date(3000) });
    expect(await db.selectFrom('turns').select(['id', 'agent']).orderBy('ordinal').execute())
      .toEqual([{ id: firstTurnId, agent: 'home' }, { id: secondTurnId, agent: null }]);
    const turns = (await new SqliteConversationHistoryRead(db).find(conversationId))?.turns;
    expect(turns?.map(turn => turn.status === 'answered' ? turn.agent : 'none')).toEqual(['home', undefined]);
    const view = await createGetConversation(new SqliteConversationHistoryRead(db))({ conversationId });
    expect(view.ok && view.value.turns.every(turn => !('agent' in turn))).toBe(true);
    expect(JSON.stringify(view)).not.toContain('home');
  });

  // Verification: Prova della continuità dell'agente nella conversazione
  it('adds the agent column to an existing archive and keeps earlier turns readable', async () => {
    const db = open(':memory:');
    const migrator = new Migrator({ db, provider: { async getMigrations() { return conversationMigrations; } } });
    expect((await migrator.migrateTo('006_per_conversation_occupancy')).error).toBeUndefined();
    await db.insertInto('conversations').values({ id: conversationId, created_at: 100, last_activity_at: 100,
      active_turn_id: null }).execute();
    await sql.raw(`insert into turns (id, conversation_id, ordinal, text, accepted_at, status, answer, finished_at)
      values ('${firstTurnId}', '${conversationId}', 1, 'legacy', 100, 'answered', 'vecchia risposta', 200)`).execute(db);
    await migrateConversationArchive(db);
    const turns = (await new SqliteConversationHistoryRead(db).find(conversationId))?.turns;
    expect(turns).toEqual([{ id: firstTurnId, text: 'legacy', acceptedAt: new Date(100), status: 'answered',
      answer: 'vecchia risposta', finishedAt: new Date(200) }]);
    expect(turns?.[0] && 'agent' in turns[0]).toBe(false);
    await db.updateTable('turns').set({ status: 'failed', answer: null, error: 'errore', agent: 'home' })
      .where('id', '=', firstTurnId).execute();
    await expect(new SqliteConversationHistoryRead(db).find(conversationId)).rejects.toThrow('Invalid persisted turn state');
  });

  it('stores and restores exact Unix milliseconds before and after the epoch', async () => {
    const db = open(':memory:');
    await migrateConversationArchive(db);
    const writer = new SqliteTurnRepository(db);
    await admitTurn(writer, { conversationId, createConversation: true,
      turn: ({ id: firstTurnId, text: 'prima', acceptedAt: new Date(-1234) }) });
    await completeTurn(writer, { turnId: firstTurnId, outcome: { kind: 'answer', text: 'ok' }, finishedAt: new Date(-12) });
    await admitTurn(writer, { conversationId, createConversation: false,
      turn: ({ id: secondTurnId, text: 'dopo', acceptedAt: new Date(1234) }) });
    await completeTurn(writer, { turnId: secondTurnId, outcome: { kind: 'error', message: 'errore' }, finishedAt: new Date(2345) });

    expect(await db.selectFrom('conversations').select(['created_at', 'last_activity_at']).executeTakeFirst())
      .toEqual({ created_at: -1234, last_activity_at: 1234 });
    expect(await db.selectFrom('turns').select(['accepted_at', 'finished_at']).orderBy('ordinal').execute())
      .toEqual([{ accepted_at: -1234, finished_at: -12 }, { accepted_at: 1234, finished_at: 2345 }]);
    const history = await new SqliteConversationHistoryRead(db).find(conversationId);
    expect(history?.createdAt).toEqual(new Date(-1234));
    expect(history?.lastActivityAt).toEqual(new Date(1234));
    expect(history?.turns.map(turn => [turn.acceptedAt, turn.status === 'pending' ? null : turn.finishedAt]))
      .toEqual([[new Date(-1234), new Date(-12)], [new Date(1234), new Date(2345)]]);
  });

  it('backfills stable ordinals when migrating an existing archive', async () => {
    const db = open(':memory:');
    const migrator = new Migrator({ db, provider: { async getMigrations() { return conversationMigrations; } } });
    const prior = await migrator.migrateTo('001_initial');
    expect(prior.error).toBeUndefined();
    await db.insertInto('conversations').values({ id: conversationId, created_at: 100, last_activity_at: 100 }).execute();
    for (const id of [firstTurnId, secondTurnId]) {
      await sql.raw(`insert into turns (id, conversation_id, text, accepted_at, status)
        values ('${id}', '${conversationId}', 'legacy', 100, 'pending')`).execute(db);
    }
    await migrateConversationArchive(db);
    const rows = await db.selectFrom('turns').select(['id', 'ordinal'])
      .where('conversation_id', '=', conversationId).orderBy('ordinal').execute();
    expect(rows).toEqual([{ id: firstTurnId, ordinal: 1 }, { id: secondTurnId, ordinal: 2 }]);
    expect((await new SqliteConversationHistoryRead(db).find(conversationId))?.turns.map(turn => turn.id))
      .toEqual([firstTurnId, secondTurnId]);
  });

  it('preserves turn order, text, outcomes and instants across a database reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ambrogio-history-'));
    directories.push(directory);
    const filename = join(directory, 'history.sqlite');
    const firstDb = open(filename);
    await migrateConversationArchive(firstDb);
    const writer = new SqliteTurnRepository(firstDb);
    await admitTurn(writer, { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await completeTurn(writer, { turnId: firstTurnId, outcome: { kind: 'answer', text: 'Prima risposta' }, finishedAt: new Date(2345) });
    await admitTurn(writer, { conversationId, createConversation: false, turn: accepted(secondTurnId) });
    const pending = await new SqliteConversationHistoryRead(firstDb).find(conversationId);
    expect(pending?.turns.map(turn => turn.status)).toEqual(['answered', 'pending']);
    await firstDb.destroy();
    opened.splice(opened.indexOf(firstDb), 1);

    const reopened = open(filename);
    await migrateConversationArchive(reopened);
    expect(await interruptPendingTurns(reopened, new Date(3456))).toBe(1);
    const history = await new SqliteConversationHistoryRead(reopened).find(conversationId);
    expect(history).toMatchObject({
      id: conversationId,
      createdAt: new Date(1234),
      lastActivityAt: new Date(1234),
    });
    expect(history?.turns).toMatchObject([
      { id: firstTurnId, text: `  ${firstTurnId}  `, status: 'answered', answer: 'Prima risposta', acceptedAt: new Date(1234), finishedAt: new Date(2345) },
      { id: secondTurnId, text: `  ${secondTurnId}  `, status: 'interrupted', acceptedAt: new Date(1234), finishedAt: new Date(3456) },
    ]);
    expect(await createGetConversation(new SqliteConversationHistoryRead(reopened))({ conversationId }))
      .toEqual({ ok: true, value: history });
    expect(await createGetConversation(new SqliteConversationHistoryRead(reopened))({ conversationId: 'missing' }))
      .toEqual({ ok: false, error: { kind: 'conversation_not_found' } });
    expect(await interruptPendingTurns(reopened, new Date(4567))).toBe(0);
    expect((await new SqliteConversationHistoryRead(reopened).find(conversationId))?.turns[1])
      .toMatchObject({ finishedAt: new Date(3456), status: 'interrupted' });
    expect(await reopened.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationId).executeTakeFirst())
      .toEqual({ active_turn_id: null });
  });

  it('rolls back recovery if releasing occupancy fails', async () => {
    const db = open(':memory:');
    await migrateConversationArchive(db);
    await admitTurn(new SqliteTurnRepository(db), { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await sql.raw("create trigger reject_recovery before update on conversations when new.active_turn_id is null begin select raise(abort, 'injected'); end").execute(db);
    await expect(interruptPendingTurns(db, new Date(3456))).rejects.toThrow();
    expect(await db.selectFrom('turns').select(['status', 'finished_at']).where('id', '=', firstTurnId).executeTakeFirst())
      .toEqual({ status: 'pending', finished_at: null });
    expect(await db.selectFrom('conversations').select('active_turn_id').where('id', '=', conversationId).executeTakeFirst())
      .toEqual({ active_turn_id: firstTurnId });
  });

  it('rejects corrupt historical instants instead of replacing them with the current time', async () => {
    const db = open(':memory:');
    await migrateConversationArchive(db);
    await admitTurn(new SqliteTurnRepository(db), { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await sql.raw(`update conversations set last_activity_at = 'bad' where id = '${conversationId}'`).execute(db);
    await expect(new SqliteConversationHistoryRead(db).find(conversationId)).rejects.toThrow('Invalid persisted instant');
    expect(await new SqliteConversationHistoryRead(db).find('missing')).toBeUndefined();
  });

  it('rejects a missing persisted turn position', async () => {
    const db = open(':memory:');
    await migrateConversationArchive(db);
    await admitTurn(new SqliteTurnRepository(db), { conversationId, createConversation: true, turn: accepted(firstTurnId) });
    await db.updateTable('turns').set({ ordinal: null as unknown as number }).where('id', '=', firstTurnId).execute();
    await expect(new SqliteConversationHistoryRead(db).find(conversationId))
      .rejects.toThrow('Invalid persisted turn order');
  });
});
