import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

// Verification: Prova della mappatura esplicita degli esiti HTTP

function files(directory: string): string[] {
  return readdirSync(join(repositoryRoot, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? files(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

const read = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8');
const packages = readdirSync(join(repositoryRoot, 'packages'));
const httpRoutes = packages.flatMap(name => {
  const directory = `packages/${name}/src/adapters/in/http`;
  try { return files(directory); } catch { return []; }
}).filter(path => path.endsWith('route.adapter.ts'));

test('the analysis finds the HTTP route registrations', () => {
  expect(httpRoutes.length).toBeGreaterThan(0);
});

test.each(httpRoutes)('%s maps every handler outcome explicitly', path => {
  const source = read(path);
  expect(source, 'switch on kind').toMatch(/switch \(outcome\.kind\)/);
  expect(source, 'assertNever in default').toMatch(/default:\s*return assertNever\(outcome\);/);
  expect(source, 'no casts').not.toMatch(/as (never|any)\b/);
  expect(source, 'no imported rejection or status table').not.toMatch(/import[^;]*(?:domain|status|Status)/);
});

test('Domain and Application contain no HTTP statuses, headers, problem types or response objects', () => {
  const core = packages.flatMap(name => ['domain', 'application'].flatMap(layer => {
    try { return files(`packages/${name}/src/${layer}`); } catch { return []; }
  })).filter(path => !path.endsWith('.spec.ts'));
  expect(core.length).toBeGreaterThan(0);
  for (const path of core) {
    const source = read(path);
    for (const pattern of [/problem\+json/, /\/problems\//, /\bfastify\b/i, /statusCode/, /\.code\(/,
      /Cache-Control/i, /X-Request-Id/i, /about:blank/]) {
      expect(source, `${relative(repositoryRoot, join(repositoryRoot, path))} ${pattern}`).not.toMatch(pattern);
    }
  }
});
