import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Distributed migration: never change, rename or remove it («Registro delle migrazioni dell'archivio conversazioni»).
export const migration: Migration = {
  async up(db: Kysely<any>) {
    // Earlier turns keep null actions: none were recorded.
    await db.schema.alterTable('turns').addColumn('actions', 'text').execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.alterTable('turns').dropColumn('actions').execute();
  },
};
