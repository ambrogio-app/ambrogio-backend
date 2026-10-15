import type { Kysely } from 'kysely';
import type { ConversationDatabase } from './schema.js';
import { toMillis } from './sqlite-turn-mapper.js';
import { withImmediateTransaction } from './sqlite-transaction.js';

/** Run after migrations and before the server enables any conversational ingress. */
export async function recoverPendingTurns(db: Kysely<ConversationDatabase>, interruptedAt: Date): Promise<number> {
  const finishedAt = toMillis(interruptedAt);
  return withImmediateTransaction(db, async connection => {
    const installation = await connection.selectFrom('installation').select('active_turn_id')
      .where('id', '=', 1).executeTakeFirst();
    if (!installation) throw new Error('Installation occupancy record missing');
    const changed = await connection.updateTable('turns')
      .set({ status: 'interrupted', finished_at: finishedAt })
      .where('status', '=', 'pending').executeTakeFirst();
    if (changed.numUpdatedRows > 0n || installation.active_turn_id !== null) {
      const released = await connection.updateTable('installation').set({ active_turn_id: null })
        .where('id', '=', 1).executeTakeFirst();
      if (released.numUpdatedRows !== 1n) throw new Error('Installation recovery postcondition failed');
    }
    return Number(changed.numUpdatedRows);
  });
}
