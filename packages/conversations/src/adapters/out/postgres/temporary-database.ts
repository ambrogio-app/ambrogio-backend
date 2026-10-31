import { randomBytes } from 'node:crypto';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { ProjectError } from '../../../domain/project-error.js';
import { migrateConversationArchive } from './migrations.js';

/** Names of the databases created for tests: the prefix recognizes them as test databases. */
export const temporaryDatabasePrefix = 'ambrogio_test_';
const temporaryName = /^ambrogio_test_[0-9a-f]{16}$/;

export type TemporaryDatabase = Readonly<{
  /** URL of the new database, on the same server and with the same role, always with a password. */
  url: string;
  /** Drops the database once, closing the connections still open to it. */
  drop(): Promise<void>;
}>;

async function onServer<T>(serverUrl: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: serverUrl, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    return await run(client);
  } finally {
    await client.end().catch(() => { /* preserve the original outcome */ });
  }
}

/**
 * Creates an empty database with a new test name on the PostgreSQL server of `serverUrl`, whose role
 * may create and drop databases. Only the database created here is ever dropped by the result.
 */
export async function createTemporaryDatabase(serverUrl: string): Promise<TemporaryDatabase> {
  let url: URL;
  try { url = new URL(serverUrl); } catch { throw new ProjectError('Invalid test database server URL'); }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new ProjectError('Invalid test database server URL');
  }
  const name = `${temporaryDatabasePrefix}${randomBytes(8).toString('hex')}`;
  await onServer(serverUrl, client => client.query(`create database "${name}"`));
  url.pathname = `/${name}`;
  // The test server trusts its connections and needs no password; the archive URL names one all the same, as the
  // configuration requires, and the server ignores it.
  if (url.password === '') url.password = 'test-server-trust';
  let dropping: Promise<void> | undefined;
  return {
    url: url.toString(),
    drop() {
      if (!temporaryName.test(name)) throw new ProjectError('Refusing to drop a database that is not a test database');
      dropping ??= onServer(serverUrl, async client => {
        await client.query(`drop database if exists "${name}" with (force)`);
      });
      return dropping;
    },
  };
}

/** A temporary database prepared with the production migrations; it is dropped if the migrations fail. */
export async function createMigratedTemporaryDatabase(serverUrl: string): Promise<TemporaryDatabase> {
  const database = await createTemporaryDatabase(serverUrl);
  try {
    const db = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: database.url, max: 1 }) }) });
    try { await migrateConversationArchive(db); } finally { await db.destroy(); }
    return database;
  } catch (error) {
    await database.drop().catch(() => { /* preserve the migration failure */ });
    throw error;
  }
}
