// database-types.mjs — the Kysely types of the archive, generated from a database built from scratch with
// the production migrations («Tipi del database con kysely-codegen»). Run after `pnpm build`.
//
//   node scripts/database-types.mjs           regenerate the versioned file
//   node scripts/database-types.mjs --verify  fail when the versioned file differs from the migrated schema
//
// The database is created on the PostgreSQL test server of AMBROGIO_TEST_DATABASE_URL and always dropped.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const conversations = new URL('../packages/conversations/', import.meta.url);
const { createMigratedTemporaryDatabase } = await import(new URL('dist/adapters/out/postgres/temporary-database.js', conversations).href);

const serverUrl = process.env.AMBROGIO_TEST_DATABASE_URL;
if (!serverUrl) {
  console.error('Missing environment variable AMBROGIO_TEST_DATABASE_URL: start one with ../ambrogio-model/scripts/test-postgres start');
  process.exit(1);
}
const verify = process.argv.includes('--verify');
const database = await createMigratedTemporaryDatabase(serverUrl);
let status = 0;
try {
  try {
    execFileSync(new URL('node_modules/.bin/kysely-codegen', `file://${root}`).pathname,
      ['--url', database.url, ...(verify ? ['--verify'] : [])], { cwd: root, stdio: 'inherit' });
  } catch {
    console.error(verify ? 'The versioned database types differ from the migrated schema: run pnpm db:types'
      : 'kysely-codegen failed');
    status = 1;
  }
} finally {
  await database.drop();
}
process.exit(status);
