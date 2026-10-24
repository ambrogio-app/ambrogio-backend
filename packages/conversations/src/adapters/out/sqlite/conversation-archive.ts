import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { ConversationDatabase } from './schema.js';
import { migrateConversationArchive } from './migrations.js';

export interface ConversationArchive {
  readonly db: Kysely<ConversationDatabase>;
  close(): Promise<void>;
}

/**
 * Opens the archive and applies the pending migrations. The caller interrupts the pending turns and
 * only then enables conversational ingresses.
 */
export async function openConversationArchive(filename: string): Promise<ConversationArchive> {
  const sqlite = new Database(filename);
  const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
  try {
    sqlite.pragma('foreign_keys = ON');
    await migrateConversationArchive(db);
    return { db, close: () => db.destroy() };
  } catch (error) {
    try { await db.destroy(); } catch { /* preserve startup failure */ }
    throw error;
  }
}
