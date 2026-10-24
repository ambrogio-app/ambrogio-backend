import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Distributed migration: never change, rename or remove it («Registro delle migrazioni dell'archivio conversazioni»).
export const migration: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.createIndex('conversations_by_activity')
      .on('conversations').columns(['last_activity_at', 'id']).execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.dropIndex('conversations_by_activity').execute();
  },
};
