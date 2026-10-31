// Verification: Prova della build e dell'avvio del server
// The static part of the proof: the build compiles with `tsc` into ES modules for Node.js 24. `main.e2e.spec.ts` starts
// the compiled entry point.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';
import { effectiveOptions } from './typescript-config.js';

const json = <T>(path: string) => JSON.parse(readFileSync(join(repositoryRoot, path), 'utf8')) as T;

test('the root build compiles the package and the server with tsc', () => {
  const build = json<{ scripts: Record<string, string> }>('package.json').scripts.build!;
  const steps = build.split('&&').map((step) => step.trim());
  expect(steps).toEqual(['tsc -p packages/conversations/tsconfig.build.json', 'tsc -p apps/server/tsconfig.build.json']);
});

test('the server package is an ES module package for Node.js 24 or later', () => {
  const manifest = json<{ type?: string; engines?: { node?: string } }>('apps/server/package.json');
  expect(manifest.type).toBe('module');
  expect(manifest.engines?.node).toBe('>=24');
});

test('the build configuration of the server emits ES modules resolved as NodeNext', () => {
  const options = effectiveOptions('apps/server/tsconfig.build.json');
  expect(options.module).toBe('NodeNext');
  expect(options.moduleResolution).toBe('NodeNext');
  expect(options.noEmit).toBe(false);
  expect(options.outDir).toBe('dist');
});
