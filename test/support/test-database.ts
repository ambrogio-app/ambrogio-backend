// Test support shared by the units: the PostgreSQL databases of the tests («Database di prova isolati del
// backend»). Every database is new, named with the test prefix, built with the production migrations when
// asked, and dropped by the test that created it; nothing falls back to another database.
import { createRequire } from 'node:module';
import { openConversationArchive, type ConversationArchive }
  from '../../packages/conversations/src/adapters/out/postgres/conversation-archive.js';
import {
  createMigratedTemporaryDatabase, createTemporaryDatabase, type TemporaryDatabase,
} from '../../packages/conversations/src/adapters/out/postgres/temporary-database.js';

/** The PostgreSQL test server; the tests fail, never skip, when it is not configured. */
export function testDatabaseServer(): string {
  const url = process.env.AMBROGIO_TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Missing environment variable AMBROGIO_TEST_DATABASE_URL: start the test server with '
      + '../ambrogio-model/scripts/test-postgres start and export the line it prints');
  }
  return url;
}

/** A new empty database, without the migrations. */
export function emptyTestDatabase(): Promise<TemporaryDatabase> {
  return createTemporaryDatabase(testDatabaseServer());
}

/** A new database prepared with the production migrations. */
export function migratedTestDatabase(): Promise<TemporaryDatabase> {
  return createMigratedTemporaryDatabase(testDatabaseServer());
}

export type TestArchive = ConversationArchive & Readonly<{
  url: string;
  /** Faults of idle connections reported by the archive. */
  idleFaults: unknown[];
  /** Closes the archive, then drops its database. */
  dispose(): Promise<void>;
}>;

/** An archive opened as the server opens it, on a new database. */
export async function openTestArchive(): Promise<TestArchive> {
  const database = await emptyTestDatabase();
  const idleFaults: unknown[] = [];
  try {
    const archive = await openConversationArchive(database.url, error => idleFaults.push(error));
    return { ...archive, url: database.url, idleFaults, async dispose() {
      try { await archive.close(); } finally { await database.drop(); }
    } };
  } catch (error) {
    await database.drop();
    throw error;
  }
}

type SqlClient = {
  connect(): Promise<void>;
  query(text: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] } | Array<{ rows: Record<string, unknown>[] }>>;
  end(): Promise<void>;
};
/** The `pg` driver of the conversations package, which owns the dependency. */
const pg = createRequire(new URL('../../packages/conversations/package.json', import.meta.url))('pg') as {
  Client: new (options: { connectionString: string }) => SqlClient;
};

/**
 * Runs SQL on a database of the test server, outside the code under test, on a connection of its own; for
 * several statements without parameters it returns the rows of the last one.
 */
export async function querySql(url: string, text: string, values: readonly unknown[] = []): Promise<Record<string, unknown>[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query(text, values);
    return Array.isArray(result) ? result.at(-1)?.rows ?? [] : result.rows;
  } finally { await client.end(); }
}

/** The names of the test databases present on the test server. */
export async function testDatabaseNames(): Promise<string[]> {
  const rows = await querySql(testDatabaseServer(),
    "select datname from pg_database where datname like 'ambrogio\\_test\\_%' order by datname");
  return rows.map(row => row.datname as string);
}

/** The tables of the public schema of a test database. */
export async function publicTables(url: string): Promise<string[]> {
  const rows = await querySql(url,
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name");
  return rows.map(row => row.table_name as string);
}
