import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import type { ConversationDatabase } from './schema.js';

const initial: Migration = {
  async up(db) {
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
  async down(db) {
    await db.schema.dropTable('installation').execute();
    await db.schema.dropTable('turns').execute();
    await db.schema.dropTable('conversations').execute();
  },
};

const orderedTurns: Migration = {
  async up(db) {
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
  async down(db) {
    await db.schema.dropIndex('turns_conversation_ordinal').execute();
    await db.schema.alterTable('turns').dropColumn('ordinal').execute();
  },
};

const listOrder: Migration = {
  async up(db) {
    await db.schema.createIndex('conversations_by_activity')
      .on('conversations').columns(['last_activity_at', 'id']).execute();
  },
  async down(db) {
    await db.schema.dropIndex('conversations_by_activity').execute();
  },
};

const turnOwner: Migration = {
  async up(db) {
    await db.schema.alterTable('installation').addColumn('active_process_id', 'integer').execute();
  },
  async down(db) {
    await db.schema.alterTable('installation').dropColumn('active_process_id').execute();
  },
};

const removeTurnOwner: Migration = {
  async up(db) {
    await db.schema.alterTable('installation').dropColumn('active_process_id').execute();
  },
  async down(db) {
    await db.schema.alterTable('installation').addColumn('active_process_id', 'integer').execute();
  },
};

export const conversationMigrations = {
  '001_initial': initial,
  '002_ordered_turns': orderedTurns,
  '003_list_order': listOrder,
  '004_turn_owner': turnOwner,
  '005_remove_turn_owner': removeTurnOwner,
};

/** Must finish successfully before any conversational ingress is enabled. */
export async function migrateConversationArchive(db: Kysely<ConversationDatabase>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: { async getMigrations() { return conversationMigrations; } },
  });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
}
