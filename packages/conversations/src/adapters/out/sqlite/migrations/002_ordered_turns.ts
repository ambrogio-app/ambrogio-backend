import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Distributed migration: never change, rename or remove it («Registro delle migrazioni dell'archivio conversazioni»).
export const migration: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.alterTable('turns').addColumn('ordinal', 'integer').execute();
    await sql.raw(`
      update turns set ordinal = (
        select count(*) from turns as earlier
        where earlier.conversation_id = turns.conversation_id and earlier.rowid <= turns.rowid
      )
    `).execute(db);
    await db.schema.createIndex('turns_conversation_ordinal')
      .unique().on('turns').columns(['conversation_id', 'ordinal']).execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.dropIndex('turns_conversation_ordinal').execute();
    await db.schema.alterTable('turns').dropColumn('ordinal').execute();
  },
};
