import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Distributed migration: never change, rename or remove it («Registro delle migrazioni dell'archivio conversazioni»).
export const migration: Migration = {
  async up(db: Kysely<any>) {
    // Earlier turns keep a null agent: the answering agent is unknown.
    await db.schema.alterTable('turns').addColumn('agent', 'text').execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.alterTable('turns').dropColumn('agent').execute();
  },
};
