import { sql, type Kysely } from 'kysely';
import type { ConversationDatabase } from './schema.js';

function isSqliteBusy(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_BUSY';
}

export class AdmissionLockBusy extends Error {
  constructor(cause: unknown) {
    super('Admission could not acquire the archive lock', { cause });
  }
}

export async function withImmediateTransaction<T>(
  db: Kysely<ConversationDatabase>,
  run: (connection: Kysely<ConversationDatabase>) => Promise<T>,
  classifyAdmissionLock = false,
): Promise<T> {
  return db.connection().execute(async connection => {
    try {
      // A synchronous busy wait can block the process that must finish the other write.
      await sql.raw('pragma busy_timeout = 0').execute(connection);
      await sql.raw('begin immediate').execute(connection);
    } catch (error) {
      if (classifyAdmissionLock && isSqliteBusy(error)) throw new AdmissionLockBusy(error);
      throw error;
    }
    try {
      const result = await run(connection);
      await sql.raw('commit').execute(connection);
      return result;
    } catch (error) {
      try { await sql.raw('rollback').execute(connection); } catch { /* preserve the original failure */ }
      throw error;
    }
  });
}
