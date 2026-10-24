// Verification: Prova dell'installazione del backend con pnpm e Corepack
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

// «Installazione delle dipendenze del backend con pnpm e Corepack»: exact versions, build scripts only for the
// listed packages, and the pnpm minimum release age without exceptions.
const read = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8');
// The project lockfile is the last YAML document; the first one records pnpm itself.
const projectLock = read('pnpm-lock.yaml').split(/^---$/m).at(-1) ?? '';
const importers = projectLock.split(/^importers:$/m)[1]?.split(/^packages:$/m)[0] ?? '';
const workspace = read('pnpm-workspace.yaml');

/** The lockfile block of one workspace importer, for example `apps/server`. */
function importer(path: string): string {
  const start = importers.indexOf(`\n  ${path}:\n`);
  expect(start, path).toBeGreaterThanOrEqual(0);
  const rest = importers.slice(start + path.length + 5);
  return rest.slice(0, rest.search(/\n {2}\S|$/));
}

function locked(block: string, name: string): Readonly<{ specifier?: string; version?: string }> {
  const key = (name.startsWith('@') ? `'${name}'` : name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^ {6}${key}:\\n {8}specifier: (\\S+)\\n {8}version: (\\S+)$`, 'm').exec(block);
  return { specifier: match?.[1], version: match?.[2]?.replace(/\(.*$/, '') };
}

test.each(['.', 'apps/server', 'packages/conversations'])('every direct dependency of %s uses the exact locked version', path => {
  const manifest = JSON.parse(read(path === '.' ? 'package.json' : `${path}/package.json`)) as {
    dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
  };
  const direct = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies });
  expect(direct.length).toBeGreaterThan(0);
  const block = importer(path);
  for (const [name, version] of direct) {
    if (name.startsWith('@ambrogio/')) {
      expect(version, name).toBe('workspace:*');
      continue;
    }
    expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
    expect(locked(block, name), name).toEqual({ specifier: version, version });
  }
  expect(existsSync(join(repositoryRoot, 'package-lock.json'))).toBe(false);
});

test('only koffi and vosk-koffi may run build scripts during installation', () => {
  expect(/^allowBuilds:\n((?: {2}.+\n)*)/m.exec(workspace)?.[1]).toBe('  koffi: true\n  vosk-koffi: true\n');
});

test('the pnpm minimum release age stays active without exceptions', () => {
  expect(workspace).not.toMatch(/^minimumReleaseAge/m);
});
