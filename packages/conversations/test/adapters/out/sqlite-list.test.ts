import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Turn } from '../../../src/domain/turn.js';
import { createListConversations } from '../../../src/application/list-conversations.use-case.js';
import { migrateConversationArchive } from '../../../src/adapters/out/sqlite/migrations.js';
import { SqliteConversationListRead } from '../../../src/adapters/out/sqlite/sqlite-conversation-list-read.js';
import { SqliteConversationWrite } from '../../../src/adapters/out/sqlite/sqlite-conversation-write.js';
import type { ConversationDatabase } from '../../../src/adapters/out/sqlite/schema.js';

const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
];

const opened: Kysely<ConversationDatabase>[] = [];

function open() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
  opened.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map(db => db.destroy()));
});

describe('conversation list', () => {
  it('orders by last admission, breaks ties by identity, and traverses bounded pages without duplicates', async () => {
    const db = open();
    await migrateConversationArchive(db);
    const write = new SqliteConversationWrite(db);
    let turnNumber = 0;
    async function add(conversationId: string, at: number, createConversation: boolean) {
      const turnId = `a0000000-0000-4000-8000-${String(++turnNumber).padStart(12, '0')}`;
      expect(await write.admit({ conversationId, createConversation,
        turn: Turn.accept({ id: turnId, text: 'testo', acceptedAt: new Date(at) }) })).toMatchObject({ ok: true });
      expect(await write.complete({ turnId, outcome: { kind: 'answer', text: 'risposta' }, finishedAt: new Date(at + 1) }))
        .toMatchObject({ ok: true });
    }
    await add(ids[0], 100, true);
    await add(ids[1], 200, true);
    await add(ids[2], 200, true);
    await add(ids[3], 300, true);
    await add(ids[0], 400, false);

    const list = createListConversations(new SqliteConversationListRead(db), 2);
    const first = await list({});
    const second = await list({ after: first.next });
    expect(first.items.map(item => item.id)).toEqual([ids[0], ids[3]]);
    expect(second.items.map(item => item.id)).toEqual([ids[2], ids[1]]);
    expect(first.items[0]?.lastActivityAt).toEqual(new Date(400));
    expect(second.next).toBeUndefined();
    expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(4);

    // Each request reads current state; refreshing starts again without the old cursor.
    await add(ids[1], 500, false);
    expect((await list({})).items.map(item => item.id)).toEqual([ids[1], ids[0]]);
  });

  it('rejects invalid fixed page sizes', () => {
    const db = open();
    const read = new SqliteConversationListRead(db);
    for (const size of [0, -1, 1.5, Number.POSITIVE_INFINITY, 101]) {
      expect(() => createListConversations(read, size)).toThrow('Invalid conversation page size');
    }
  });

  it('reports incompatible persisted activity instead of inventing a date', async () => {
    const db = open();
    await migrateConversationArchive(db);
    await sql.raw(`insert into conversations (id, created_at, last_activity_at)
      values ('${ids[0]}', 0, 'bad')`).execute(db);
    const list = createListConversations(new SqliteConversationListRead(db));
    await expect(list({})).rejects.toThrow('Invalid persisted instant');
  });
});
