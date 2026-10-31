import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { ProjectError } from '../../../domain/project-error.js';
import { postgresConnection } from '../conversation-config.js';
import type { DB } from './database.generated.js';
import { migrateConversationArchive } from './migrations.js';

/** The tables of the conversation archive, as generated from the migrated schema. */
export type ConversationDatabase = DB;

export interface ConversationArchive {
  readonly db: Kysely<ConversationDatabase>;
  /** Destroys the owned instance once; repeated or concurrent calls share the first outcome. */
  close(): Promise<void>;
}

/** Technical constants of the archive pool, not configuration values. */
export const archivePool = { max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 } as const;

/** Receives each fault of an idle pool connection once; the pool has already discarded the connection. */
export type IdleConnectionFault = (error: unknown) => void;

/**
 * Opens the archive named by a URL valid for the configuration and applies the pending migrations, which also establish the first connection. The
 * caller interrupts the pending turns and only then enables conversational ingresses.
 */
export async function openConversationArchive(databaseUrl: string,
  onIdleConnectionFault: IdleConnectionFault): Promise<ConversationArchive> {
  const connection = postgresConnection(databaseUrl);
  if (!connection) throw new ProjectError('Conversation archive URL is not valid');
  // Each part is given explicitly, never the whole URL, and TLS is off: the driver falls back on no `PG*` variable
  // and no password file.
  const pool = new pg.Pool({ host: connection.host, port: connection.port, user: connection.user,
    password: connection.password, database: connection.database, ssl: false, ...archivePool });
  // Without a listener an idle connection that fails would end the process.
  pool.on('error', error => onIdleConnectionFault(error));
  const db = new Kysely<ConversationDatabase>({ dialect: new PostgresDialect({ pool }) });
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= db.destroy());
  try {
    await migrateConversationArchive(db);
    return { db, close };
  } catch (error) {
    try { await close(); } catch { /* preserve startup failure */ }
    throw error;
  }
}
