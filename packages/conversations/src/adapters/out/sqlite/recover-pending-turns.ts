import type { Kysely } from 'kysely';
import type { ConversationDatabase } from './schema.js';
import { toMillis } from './sqlite-turn-mapper.js';
import { withImmediateTransaction } from './sqlite-transaction.js';

/** Run after migrations and before the server enables any conversational ingress. */
export async function recoverPendingTurns(db: Kysely<ConversationDatabase>, interruptedAt: Date): Promise<number> {
  const finishedAt = toMillis(interruptedAt);
  return withImmediateTransaction(db, async connection => {
    const changed = await connection.updateTable('turns')
      .set({ status: 'interrupted', finished_at: finishedAt })
      .where('status', '=', 'pending').executeTakeFirst();
    await connection.updateTable('conversations').set({ active_turn_id: null })
      .where('active_turn_id', 'is not', null).execute();
    return Number(changed.numUpdatedRows);
  });
}
