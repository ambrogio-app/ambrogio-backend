import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export const migration: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.createTable('conversations')
      .addColumn('id', 'uuid', column => column.primaryKey())
      .addColumn('created_at', sql`timestamptz(3)`, column => column.notNull())
      .addColumn('last_activity_at', sql`timestamptz(3)`, column => column.notNull())
      .addColumn('active_turn_id', 'uuid')
      .execute();

    await db.schema.createTable('turns')
      .addColumn('id', 'uuid', column => column.primaryKey())
      .addColumn('conversation_id', 'uuid', column => column.notNull().references('conversations.id'))
      .addColumn('ordinal', 'integer', column => column.notNull())
      .addColumn('text', 'text', column => column.notNull())
      .addColumn('accepted_at', sql`timestamptz(3)`, column => column.notNull())
      .addColumn('status', 'text', column => column.notNull())
      .addColumn('answer', 'text')
      .addColumn('error', 'text')
      .addColumn('finished_at', sql`timestamptz(3)`)
      .addColumn('agent', 'text')
      .addColumn('actions', 'jsonb')
      .addUniqueConstraint('turns_conversation_ordinal', ['conversation_id', 'ordinal'])
      // SQL NULL is a turn without actions: a JSON document is always an array, never JSON null.
      .addCheckConstraint('turns_actions_array', sql`jsonb_typeof(actions) = 'array'`)
      .execute();

    // The two tables refer to each other: the occupancy reference is added once both exist.
    await db.schema.alterTable('conversations')
      .addForeignKeyConstraint('conversations_active_turn', ['active_turn_id'], 'turns', ['id'])
      .execute();

    await db.schema.createIndex('conversations_by_activity')
      .on('conversations').columns(['last_activity_at', 'id']).execute();
    await db.schema.createIndex('turns_by_status')
      .on('turns').columns(['status', 'accepted_at', 'id']).execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.alterTable('conversations').dropConstraint('conversations_active_turn').execute();
    await db.schema.dropTable('turns').execute();
    await db.schema.dropTable('conversations').execute();
  },
};
