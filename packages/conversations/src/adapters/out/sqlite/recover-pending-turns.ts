import type { Kysely } from 'kysely';
import type { ConversationDatabase } from './schema.js';
import { toMillis } from './sqlite-turn-mapper.js';
import { withImmediateTransaction } from './sqlite-transaction.js';

/** Run once at exclusive installation startup, before enabling any conversational ingress. */
export async function recoverPendingTurns(db: Kysely<ConversationDatabase>, interruptedAt: Date): Promise<number> {
  const finishedAt = toMillis(interruptedAt);
  return withImmediateTransaction(db, async connection => {
    const installation = await connection.selectFrom('installation').select('active_turn_id')
      .where('id', '=', 1).executeTakeFirst();
    if (!installation) throw new Error('Installation occupancy record missing');
    const pending = await connection.selectFrom('turns').select('id').where('status', '=', 'pending').execute();
    if (pending.length === 0 && installation.active_turn_id === null) return 0;
    if (pending.length !== 1 || installation.active_turn_id !== pending[0]?.id) {
      throw new Error('Inconsistent pending turn and installation occupancy');
    }
    const turnId = pending[0].id;
    const changed = await connection.updateTable('turns')
      .set({ status: 'interrupted', finished_at: finishedAt })
      .where('id', '=', turnId).where('status', '=', 'pending').executeTakeFirst();
    if (changed.numUpdatedRows !== 1n) throw new Error('Turn recovery postcondition failed');
    const released = await connection.updateTable('installation').set({ active_turn_id: null })
      .where('id', '=', 1).where('active_turn_id', '=', turnId).executeTakeFirst();
    if (released.numUpdatedRows !== 1n) throw new Error('Installation recovery postcondition failed');
    return 1;
  });
}
