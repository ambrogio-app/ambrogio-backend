// Verification: Prova dell'isolamento dei database di prova
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

// «Database di prova isolati del backend»: every test that uses PostgreSQL creates its own databases on the test
// server through `test/support/test-database.ts`, which reads only AMBROGIO_TEST_DATABASE_URL, names them with the
// test prefix, migrates them with the production migrations and drops only the ones it created.
const harness = 'test/support/test-database.ts';
const temporary = 'packages/conversations/src/adapters/out/postgres/temporary-database.ts';
const text = (file: string) => readFileSync(join(repositoryRoot, file), 'utf8');
const testFiles = ['packages', 'apps', 'test']
  .flatMap((top) => readdirSync(join(repositoryRoot, top), { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.spec\.ts$/.test(name) && !/(^|\/)(node_modules|dist)\//.test(name))
    .map((name) => join(top, name)));
const integrationFiles = testFiles.filter((file) => file.endsWith('.integration.spec.ts'));

/** Whether a file imports the shared module, directly or through a test support module it imports. */
function importsHarness(file: string, seen = new Set<string>()): boolean {
  if (seen.has(file)) return false;
  seen.add(file);
  for (const match of text(file).matchAll(/^\s*(?:import|export)\b[^']*?\bfrom '(\.[^']+)'/gm)) {
    const target = join(dirname(file), match[1]!).replace(/\.js$/, '.ts');
    if (target === harness) return true;
    if (/(^|\/)test\/support\//.test(target) && importsHarness(target, seen)) return true;
  }
  return false;
}

test('the integration tests exist and each creates its databases with the shared module', () => {
  expect(integrationFiles.length).toBeGreaterThan(0);
  for (const file of integrationFiles) expect(importsHarness(file), file).toBe(true);
});

test('no test file reads the test server variable or the database of the installation', () => {
  for (const file of testFiles) {
    expect(text(file), file).not.toMatch(/process\.env\.AMBROGIO_DATABASE_URL|process\.env\[['"]AMBROGIO_DATABASE_URL/);
  }
  // The tests that use the database reach the test server only through the shared module.
  for (const file of testFiles.filter((name) => /\.(integration|e2e)\.spec\.ts$/.test(name))) {
    expect(text(file), file).not.toContain('AMBROGIO_TEST_DATABASE_URL');
  }
});

test('the shared module reads only the test server variable, without any fallback', () => {
  const source = text(harness);
  expect([...source.matchAll(/process\.env\.(\w+)/g)].map((match) => match[1])).toEqual(['AMBROGIO_TEST_DATABASE_URL']);
  expect(source).not.toMatch(/process\.env\[|AMBROGIO_DATABASE_URL|\?\?\s*['"]postgres/);
  // A missing or empty value fails with the name of the variable, and nothing replaces it.
  expect(source).toMatch(/const url = process\.env\.AMBROGIO_TEST_DATABASE_URL;\s*if \(!url\) \{\s*throw new Error\('Missing environment variable AMBROGIO_TEST_DATABASE_URL/);
});

test('the databases are named with the test prefix, migrated, and only the created ones are dropped', () => {
  const source = text(temporary);
  expect(source).toMatch(/temporaryDatabasePrefix = 'ambrogio_test_'/);
  expect(source).toMatch(/\$\{temporaryDatabasePrefix\}\$\{randomBytes\(8\)\.toString\('hex'\)\}/);
  // The drop names only the database created by the same call, checked against the test name form.
  expect([...source.matchAll(/`drop database[^`]*`/g)].map((match) => match[0])).toEqual(['`drop database if exists "${name}" with (force)`']);
  expect(source).toMatch(/if \(!temporaryName\.test\(name\)\) throw/);
  expect(source).toMatch(/await migrateConversationArchive\(db\)/);
  expect(text(harness)).toMatch(/createMigratedTemporaryDatabase\(testDatabaseServer\(\)\)/);
});
