import { sql, type Kysely, type Transaction } from 'kysely';
import type { ConversationDatabase } from './conversation-archive.js';

/** No wait for a lock lasts longer than this inside a write transaction of the archive. */
export const lockTimeoutMs = 1000;

/** SQLSTATE of a lock not obtained within `lock_timeout`. */
const lockNotAvailable = '55P03';

export function isLockNotAvailable(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === lockNotAvailable;
}

/**
 * Runs one short write transaction with `READ COMMITTED` and `READ WRITE` declared explicitly and a
 * local lock timeout. The transaction handle never outlives `run`; nothing is retried.
 */
export function withWriteTransaction<T>(
  db: Kysely<ConversationDatabase>,
  run: (transaction: Transaction<ConversationDatabase>) => Promise<T>,
): Promise<T> {
  return db.transaction().setIsolationLevel('read committed').setAccessMode('read write')
    .execute(async transaction => {
      await sql`select set_config('lock_timeout', ${`${lockTimeoutMs}ms`}, true)`.execute(transaction);
      return run(transaction);
    });
}
