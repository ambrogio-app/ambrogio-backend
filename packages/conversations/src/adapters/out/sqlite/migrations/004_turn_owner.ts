import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Distributed migration: never change, rename or remove it («Registro delle migrazioni dell'archivio conversazioni»).
export const migration: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.alterTable('installation').addColumn('active_process_id', 'integer').execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.alterTable('installation').dropColumn('active_process_id').execute();
  },
};
