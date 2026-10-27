import { sql } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import { openTestArchive, type TestArchive } from '../../../../../../test/support/test-database.js';
import { conversationMigrations, migrateConversationArchive } from './migrations.js';

let archive: TestArchive | undefined;
afterEach(async () => { await archive?.dispose(); archive = undefined; });

describe('conversation archive migrations on PostgreSQL', () => {
  // Verification: Prova del registro delle migrazioni
  it('record every applied migration once and refuse to start when an applied one is missing from the sequence', async () => {
    archive = await openTestArchive();
    const applied = await sql<{ name: string }>`select name from kysely_migration order by name`.execute(archive.db);
    expect(applied.rows.map(row => row.name)).toEqual(Object.keys(conversationMigrations));
    await migrateConversationArchive(archive.db);
    expect((await sql<{ count: string }>`select count(*) from kysely_migration`.execute(archive.db)).rows[0]?.count)
      .toBe(String(Object.keys(conversationMigrations).length));
    await sql`insert into kysely_migration (name, timestamp) values ('999_removed', ${new Date().toISOString()})`
      .execute(archive.db);
    await expect(migrateConversationArchive(archive.db)).rejects.toThrow(/999_removed/);
  });
});
