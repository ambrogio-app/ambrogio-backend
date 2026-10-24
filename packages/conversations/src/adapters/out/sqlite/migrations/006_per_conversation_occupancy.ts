import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Distributed migration: never change, rename or remove it («Registro delle migrazioni dell'archivio conversazioni»).
export const migration: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.alterTable('conversations')
      .addColumn('active_turn_id', 'text', column => column.references('turns.id')).execute();
    await sql.raw(`
      update conversations set active_turn_id = (
        select installation.active_turn_id from installation
        join turns on turns.id = installation.active_turn_id
        where turns.conversation_id = conversations.id
      )
    `).execute(db);
    await db.schema.dropTable('installation').execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.createTable('installation')
      .addColumn('id', 'integer', column => column.primaryKey())
      .addColumn('active_turn_id', 'text', column => column.references('turns.id'))
      .execute();
    const active = await db.selectFrom('conversations')
      .select('active_turn_id').where('active_turn_id', 'is not', null).execute();
    if (active.length > 1) throw new Error('Cannot restore global occupancy with multiple active conversations');
    await db.insertInto('installation').values({ id: 1, active_turn_id: active[0]?.active_turn_id ?? null }).execute();
    await db.schema.alterTable('conversations').dropColumn('active_turn_id').execute();
  },
};
