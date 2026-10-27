import type { Kysely } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import { migration as initial } from './migrations/001_initial.js';

/**
 * The single ordered sequence of the archive, one file per migration named as its key. A new migration
 * is appended here and in `migrations/fingerprints.json`; a registered one never changes.
 */
export const conversationMigrations: Readonly<Record<string, Migration>> = {
  '001_initial': initial,
};

/**
 * Must finish successfully before any conversational ingress is enabled. Kysely keeps one record of
 * the applied migrations and refuses an applied migration missing from the sequence or out of order.
 */
export async function migrateConversationArchive(db: Kysely<any>,
  migrations: Readonly<Record<string, Migration>> = conversationMigrations): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: { async getMigrations() { return { ...migrations }; } },
    allowUnorderedMigrations: false,
  });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
}
