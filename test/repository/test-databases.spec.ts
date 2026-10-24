// Verification: Prova dell'isolamento dei database di prova
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

// «Database di prova isolati del backend»: every SQLite integration test builds its own database, in memory or in a
// temporary folder it creates and removes, with the production migrations, and never reads the installation settings.
const folder = 'packages/conversations/src/adapters/out/sqlite';
const files = readdirSync(join(repositoryRoot, folder)).filter((name) => name.endsWith('.integration.spec.ts'));
const text = (name: string) => readFileSync(join(repositoryRoot, folder, name), 'utf8');

test('the SQLite integration tests exist', () => {
  expect(files.length).toBeGreaterThan(0);
});

test.each(files)('%s uses only databases it creates, migrated with the production migrations', (name) => {
  const source = text(name);
  expect(source).not.toMatch(/process\.env|AMBROGIO_/);
  expect(source).toMatch(/from '\.\/migrations\.js'|from '\.\/conversation-archive\.js'/);
  const files = [...source.matchAll(/new Database\(([^),]+)/g)].map((match) => match[1]!.trim());
  expect(files.length).toBeGreaterThan(0);
  if (files.some((argument) => argument !== "':memory:'")) {
    expect(source).toMatch(/mkdtempSync\(join\(tmpdir\(\), 'ambrogio-[a-z-]+-'\)\)/);
    expect(source).toMatch(/rmSync\(\w+, \{ recursive: true, force: true \}\)/);
  }
});
