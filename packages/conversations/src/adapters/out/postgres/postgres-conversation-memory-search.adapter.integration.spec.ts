import { sql, type Kysely } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import { openTestArchive, type TestArchive } from '../../../../../../test/support/test-database.js';
import { admitTurn, completeTurn } from '../../../../test/support/turn-archive.js';
import type { CompleteTurnOutcome } from '../../../application/complete-turn/complete-turn.use-case.js';
import type { ConversationDatabase } from './conversation-archive.js';
import { PostgresConversationMemorySearch } from './postgres-conversation-memory-search.adapter.js';
import { PostgresTurnRepository } from './postgres-turn-repository.adapter.js';

const opened: TestArchive[] = [];
afterEach(async () => { await Promise.all(opened.splice(0).map(archive => archive.dispose())); });

let sequence = 0;
const uuid = (prefix: string) => `${prefix}000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

/** Stores one turn of a new conversation, concluded as asked. */
async function stored(turns: PostgresTurnRepository, text: string, acceptedAt: Date,
  outcome: CompleteTurnOutcome | 'pending') {
  const conversationId = uuid('c0');
  const turnId = uuid('a0');
  expect(await admitTurn(turns, { conversationId, createConversation: true, turn: { id: turnId, text, acceptedAt } }))
    .toMatchObject({ ok: true });
  if (outcome !== 'pending') {
    expect(await completeTurn(turns, { turnId, outcome, finishedAt: new Date(acceptedAt.getTime() + 1000) }))
      .toMatchObject({ ok: true });
  }
  return { conversationId, turnId };
}

async function archive(): Promise<{ db: Kysely<ConversationDatabase>; turns: PostgresTurnRepository }> {
  const opening = await openTestArchive();
  opened.push(opening);
  return { db: opening.db, turns: new PostgresTurnRepository(opening.db) };
}

describe('memory search on PostgreSQL', () => {
  // Verification: Prova della ricerca nella memoria
  it('finds the answered turns by any form of a word, most relevant first, within the limit', async () => {
    const { db, turns } = await archive();
    const dentist = await stored(turns, 'Quando ho la visita dal dentista?', new Date('2026-10-20T08:00:00Z'),
      { kind: 'answer', text: 'La visita dal dentista è giovedì alle 15: il dentista ha confermato.', agent: 'generic' });
    const dentists = await stored(turns, 'Conosci dei dentisti in zona?', new Date('2026-10-21T08:00:00Z'),
      { kind: 'answer', text: 'Non ho informazioni sui dentisti della zona.' });
    await stored(turns, 'Il dentista ha chiamato?', new Date('2026-10-22T08:00:00Z'), { kind: 'error', message: 'Errore' });
    await stored(turns, 'Prenota il dentista', new Date('2026-10-22T09:00:00Z'), { kind: 'interrupted' });
    await stored(turns, 'Chiama il dentista', new Date('2026-10-22T10:00:00Z'), 'pending');
    await stored(turns, 'Che tempo fa?', new Date('2026-10-22T11:00:00Z'), { kind: 'answer', text: 'Sereno.' });
    const search = new PostgresConversationMemorySearch(db, 'it', 'Europe/Rome');
    const found = await search.search({ text: 'dentista', limit: 5 });
    // Only answered turns, singular and plural alike.
    expect(new Set(found.map(match => match.turnId))).toEqual(new Set([dentist.turnId, dentists.turnId]));
    expect(found.find(match => match.turnId === dentist.turnId)).toEqual({ conversationId: dentist.conversationId,
      turnId: dentist.turnId, acceptedAt: new Date('2026-10-20T08:00:00Z'), question: 'Quando ho la visita dal dentista?',
      answer: 'La visita dal dentista è giovedì alle 15: il dentista ha confermato.' });
    // The turn that names the word three times ranks first, before the more recent one that names it twice.
    expect(found[0]!.turnId).toBe(dentist.turnId);
    expect(await search.search({ text: 'dentisti', limit: 1 })).toHaveLength(1);
    expect(await search.search({ text: '"visita dal dentista"', limit: 5 })).toMatchObject([{ turnId: dentist.turnId }]);
    expect(await search.search({ text: 'dentista -visita', limit: 5 })).toMatchObject([{ turnId: dentists.turnId }]);
    expect(await search.search({ text: 'giraffa', limit: 5 })).toEqual([]);
    // Only stop words: nothing to search.
    expect(await search.search({ text: 'il la di', limit: 5 })).toEqual([]);
  });

  // Verification: Prova della ricerca nella memoria
  it('orders equal ranks by the newest turn first, then by turn id, and never returns agent or actions', async () => {
    const { db, turns } = await archive();
    const answer = { kind: 'answer' as const, text: 'Il bidone della carta si espone il martedì.', agent: 'home',
      actions: [{ tool: 'calendar_read', input: { day: 'tuesday' }, output: { private: 'AGENT_ACTION_MARKER' } }] };
    const older = await stored(turns, 'Quando passa la carta?', new Date('2026-10-20T08:00:00Z'), answer);
    const newerFirstId = await stored(turns, 'Quando passa la carta?', new Date('2026-10-21T08:00:00Z'), answer);
    const newerSecondId = await stored(turns, 'Quando passa la carta?', new Date('2026-10-21T08:00:00Z'), answer);
    expect(newerFirstId.turnId < newerSecondId.turnId).toBe(true);
    const search = new PostgresConversationMemorySearch(db, 'it', 'Europe/Rome');
    const found = await search.search({ text: 'carta', limit: 5 });
    expect(found.map(match => match.turnId)).toEqual([newerFirstId.turnId, newerSecondId.turnId, older.turnId]);
    for (const match of found) {
      expect(Object.keys(match).sort()).toEqual(['acceptedAt', 'answer', 'conversationId', 'question', 'turnId']);
    }
    expect(JSON.stringify(found)).not.toMatch(/AGENT_ACTION_MARKER|calendar_read|"home"/);
  });

  // Verification: Prova della ricerca nella memoria
  it('keeps the days of the family time zone, both ends included', async () => {
    const { db, turns } = await archive();
    // 23:30 UTC on 20 October is already 21 October in Rome.
    const late = await stored(turns, 'Pizza stasera?', new Date('2026-10-20T23:30:00Z'), { kind: 'answer', text: 'Pizza sì.' });
    const early = await stored(turns, 'Pizza a pranzo?', new Date('2026-10-20T10:00:00Z'), { kind: 'answer', text: 'Pizza no.' });
    const search = new PostgresConversationMemorySearch(db, 'it', 'Europe/Rome');
    expect((await search.search({ text: 'pizza', from: '2026-10-21', to: '2026-10-21', limit: 5 })).map(m => m.turnId))
      .toEqual([late.turnId]);
    expect((await search.search({ text: 'pizza', to: '2026-10-20', limit: 5 })).map(m => m.turnId)).toEqual([early.turnId]);
    expect(await search.search({ text: 'pizza', from: '2026-10-20', limit: 5 })).toHaveLength(2);
  });

  // Verification: Prova della ricerca nella memoria
  it('uses the configuration and the index of the language of the installation', async () => {
    const { db, turns } = await archive();
    await stored(turns, 'Where are the keys?', new Date('2026-10-20T08:00:00Z'), { kind: 'answer', text: 'The keys are on the table.' });
    expect(await new PostgresConversationMemorySearch(db, 'en', 'UTC').search({ text: 'key', limit: 5 })).toHaveLength(1);
    // On a small table the planner may prefer another index: without it and without sequential scans, the plan shows
    // whether the search expression matches the full-text index of the language.
    await sql`drop index turns_by_status`.execute(db);
    await sql`set enable_seqscan = off`.execute(db);
    for (const [configuration] of [['italian'], ['english']]) {
      const plan = await sql<{ 'QUERY PLAN': string }>`explain select id from turns where status = 'answered'
        and to_tsvector(${sql.lit(configuration)}, text || ' ' || answer) @@ websearch_to_tsquery(${sql.lit(configuration)}, 'chiavi')`
        .execute(db);
      expect(plan.rows.map(row => row['QUERY PLAN']).join('\n')).toContain(`turns_search_${configuration}`);
    }
  });

  // Verification: Prova dei turni ricercabili alla conclusione
  it('finds a turn from the confirmed conclusion, never while pending', async () => {
    const { db, turns } = await archive();
    const search = new PostgresConversationMemorySearch(db, 'it', 'UTC');
    const { turnId } = await stored(turns, 'Dove ho messo gli occhiali?', new Date('2026-10-20T08:00:00Z'), 'pending');
    expect(await search.search({ text: 'occhiali', limit: 5 })).toEqual([]);
    await sql.raw(`create function reject_release() returns trigger language plpgsql as $$ begin raise exception 'injected'; end $$`).execute(db);
    await sql.raw(`create trigger reject_release before update on conversations for each row
      when (new.active_turn_id is null) execute function reject_release()`).execute(db);
    await expect(completeTurn(turns, { turnId, outcome: { kind: 'answer', text: 'Sul tavolo.' }, finishedAt: new Date() }))
      .rejects.toThrow();
    expect(await search.search({ text: 'occhiali', limit: 5 })).toEqual([]);
    await sql.raw('drop trigger reject_release on conversations').execute(db);
    expect(await completeTurn(turns, { turnId, outcome: { kind: 'answer', text: 'Sul tavolo.' }, finishedAt: new Date() }))
      .toMatchObject({ ok: true });
    expect(await search.search({ text: 'occhiali', limit: 5 })).toMatchObject([{ turnId, answer: 'Sul tavolo.' }]);
  });
});
