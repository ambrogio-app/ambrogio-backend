import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Full-text indexes of the answered turns, one per language of the installation. A query uses the same expression
 * with the configuration of AMBROGIO_LANGUAGE, so that PostgreSQL uses the matching index.
 */
export const migration: Migration = {
  async up(db: Kysely<any>) {
    await sql`create index turns_search_italian on turns
      using gin (to_tsvector('italian', text || ' ' || answer)) where status = 'answered'`.execute(db);
    await sql`create index turns_search_english on turns
      using gin (to_tsvector('english', text || ' ' || answer)) where status = 'answered'`.execute(db);
  },
  async down(db: Kysely<any>) {
    await db.schema.dropIndex('turns_search_english').execute();
    await db.schema.dropIndex('turns_search_italian').execute();
  },
};
