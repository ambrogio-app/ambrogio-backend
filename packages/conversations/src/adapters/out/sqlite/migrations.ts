import type { Kysely } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import type { ConversationDatabase } from './schema.js';
import { migration as initial } from './migrations/001_initial.js';
import { migration as orderedTurns } from './migrations/002_ordered_turns.js';
import { migration as listOrder } from './migrations/003_list_order.js';
import { migration as turnOwner } from './migrations/004_turn_owner.js';
import { migration as removeTurnOwner } from './migrations/005_remove_turn_owner.js';
import { migration as perConversationOccupancy } from './migrations/006_per_conversation_occupancy.js';
import { migration as turnAgent } from './migrations/007_turn_agent.js';

/**
 * The single ordered sequence of the archive, one file per migration named as its key. A new migration
 * is appended here and in `migrations/fingerprints.json`; a registered one never changes.
 */
export const conversationMigrations: Readonly<Record<string, Migration>> = {
  '001_initial': initial,
  '002_ordered_turns': orderedTurns,
  '003_list_order': listOrder,
  '004_turn_owner': turnOwner,
  '005_remove_turn_owner': removeTurnOwner,
  '006_per_conversation_occupancy': perConversationOccupancy,
  '007_turn_agent': turnAgent,
};

/**
 * Must finish successfully before any conversational ingress is enabled. Kysely keeps one record of
 * the applied migrations and refuses an applied migration missing from the sequence or out of order.
 */
export async function migrateConversationArchive(db: Kysely<ConversationDatabase>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: { async getMigrations() { return { ...conversationMigrations }; } },
    allowUnorderedMigrations: false,
  });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
}
