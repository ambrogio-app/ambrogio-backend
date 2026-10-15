import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { ConversationDatabase } from './schema.js';
import { migrateConversationArchive } from './migrations.js';
import { recoverPendingTurns } from './recover-pending-turns.js';

export interface ConversationArchive {
  readonly db: Kysely<ConversationDatabase>;
  readonly recoveredTurns: number;
  close(): Promise<void>;
}

/** The caller may enable conversational ingresses only after this resolves. */
export async function openConversationArchive(filename: string, interruptedAt: Date): Promise<ConversationArchive> {
  const sqlite = new Database(filename);
  const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
  try {
    sqlite.pragma('foreign_keys = ON');
    await migrateConversationArchive(db);
    const recoveredTurns = await recoverPendingTurns(db, interruptedAt);
    return { db, recoveredTurns, close: () => db.destroy() };
  } catch (error) {
    try { await db.destroy(); } catch { /* preserve startup failure */ }
    throw error;
  }
}
