import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Distributed migration: never change, rename or remove it («Registro delle migrazioni dell'archivio conversazioni»).
export const migration: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.createTable('conversations')
      .addColumn('id', 'text', column => column.primaryKey())
      .addColumn('created_at', 'integer', column => column.notNull())
      .addColumn('last_activity_at', 'integer', column => column.notNull())
      .execute();

    await db.schema.createTable('turns')
      .addColumn('id', 'text', column => column.primaryKey())
      .addColumn('conversation_id', 'text', column => column.notNull().references('conversations.id'))
      .addColumn('text', 'text', column => column.notNull())
      .addColumn('accepted_at', 'integer', column => column.notNull())
      .addColumn('status', 'text', column => column.notNull())
      .addColumn('answer', 'text')
      .addColumn('error', 'text')
      .addColumn('finished_at', 'integer')
      .execute();

    await db.schema.createIndex('turns_by_conversation')
      .on('turns').columns(['conversation_id', 'accepted_at']).execute();

    await db.schema.createTable('installation')
      .addColumn('id', 'integer', column => column.primaryKey())
      .addColumn('active_turn_id', 'text', column => column.references('turns.id'))
      .execute();
    await db.insertInto('installation').values({ id: 1, active_turn_id: null }).execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.dropTable('installation').execute();
    await db.schema.dropTable('turns').execute();
    await db.schema.dropTable('conversations').execute();
  },
};
