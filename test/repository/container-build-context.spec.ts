// Verification: Prova del contesto di build dell'immagine del server
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

// «Profilo dell'immagine Docker del server»: the build context leaves out the Git history, installed dependencies,
// build outputs, the model, the tests, local databases and environment files.
test('the container build context excludes history, dependencies, outputs, model, tests, databases and environment files', () => {
  const entries = readFileSync(join(repositoryRoot, '.dockerignore'), 'utf8').split('\n').map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  expect(entries).toEqual(expect.arrayContaining(['.git', 'node_modules', '**/node_modules', 'dist', '**/dist',
    'system-model', '**/test', '**/*.spec.ts', '*.sqlite', '*.sqlite-*', '*.db', '*.db-*', '*.env', '*.env.*']));
  expect(entries.filter((entry) => entry.startsWith('!'))).toEqual([]);
});
