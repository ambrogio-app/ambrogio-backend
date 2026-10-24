import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

const modulePackage = 'packages/conversations';
const tsc = join(repositoryRoot, 'node_modules/.bin/tsc');

// Only the standard ECMAScript library: no DOM, no @types/node, no other ambient declarations.
const compilerOptions = {
  target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true,
  verbatimModuleSyntax: true, skipLibCheck: true, lib: ['ESNext'], types: [],
};

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'ambrogio-layer-independence-')); });
afterEach(() => rmSync(directory, { recursive: true, force: true }));

/** Run the `tsc` command line of the typescript devDependency on a generated configuration. */
function compile(files: readonly string[]) {
  const config = join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions, files }));
  const result = spawnSync(tsc, ['-p', config, '--pretty', 'false'], { cwd: repositoryRoot, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}`, error: result.error };
}

const layerFiles = ['src/domain', 'src/application'].flatMap((layer) =>
  readdirSync(join(repositoryRoot, modulePackage, layer), { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.ts')).map((name) => `${modulePackage}/${layer}/${name.split('\\').join('/')}`));

test('host APIs are reported when only the ECMAScript library is available', () => {
  const example = join(directory, 'uses-host.ts');
  writeFileSync(example, 'export const exit = () => process.exit(1);\nexport const later = () => setTimeout(() => {}, 1);\n');
  const result = compile([example]);
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  expect(result.output).toContain("'process'");
  expect(result.output).toContain("'setTimeout'");
});

// Verification: Prova dell'indipendenza tecnica di Domain e Application
test('Domain and Application compile with ECMAScript alone', () => {
  expect(layerFiles.some((file) => file.includes('/src/domain/'))).toBe(true);
  expect(layerFiles.some((file) => file.includes('/src/application/'))).toBe(true);
  const result = compile(layerFiles.map((file) => join(repositoryRoot, file)));
  expect(result.error).toBeUndefined();
  expect(result.output).toBe('');
  expect(result.status).toBe(0);
});

// The import rule of the same verification, «domain-application-own-package», is in architecture-rules.ts.
