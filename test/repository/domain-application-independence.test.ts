import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { parseProject, repositoryRoot, resolveSpecifier } from './typescript-program.js';

const modulePackage = 'packages/conversations';

// Only the standard ECMAScript library: no DOM, no @types/node, no other ambient declarations.
const compilerOptions = {
  target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true,
  verbatimModuleSyntax: true, skipLibCheck: true, lib: ['ESNext'], types: [],
};

const layerFiles = ['src/domain', 'src/application'].flatMap((layer) =>
  readdirSync(join(repositoryRoot, modulePackage, layer), { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.ts')).map((name) => `${layer}/${name.split('\\').join('/')}`));

test('host APIs are reported when only the ECMAScript library is available', () => {
  const example = `${modulePackage}/test-fixtures/uses-host.ts`;
  const parsed = parseProject(`${modulePackage}/test-fixtures/tsconfig.json`,
    { compilerOptions, files: ['uses-host.ts'] },
    { [example]: 'export const exit = () => process.exit(1);\nexport const later = () => setTimeout(() => {}, 1);\n' }, true);
  const texts = parsed.diagnostics.filter((diagnostic) => diagnostic.path === example).map((diagnostic) => diagnostic.text);
  expect(texts.some((text) => text.includes("'process'"))).toBe(true);
  expect(texts.some((text) => text.includes("'setTimeout'"))).toBe(true);
});

// Verification: Prova dell'indipendenza tecnica di Domain e Application
test('Domain and Application compile with ECMAScript alone and import only package sources', () => {
  expect(layerFiles.some((file) => file.startsWith('src/domain/'))).toBe(true);
  expect(layerFiles.some((file) => file.startsWith('src/application/'))).toBe(true);
  const parsed = parseProject(`${modulePackage}/tsconfig.layer-independence.json`,
    { compilerOptions, files: layerFiles }, {}, true);
  expect(parsed.diagnostics).toEqual([]);
  const violations: string[] = [];
  for (const file of parsed.files) {
    for (const specifier of file.specifiers) {
      if (!specifier.startsWith('.') || !resolveSpecifier(file.path, specifier).startsWith(`${modulePackage}/src/`)) {
        violations.push(`${file.path} -> ${specifier}`);
      }
    }
  }
  expect(parsed.files.map((file) => file.path)).toEqual(
    expect.arrayContaining(layerFiles.map((file) => `${modulePackage}/${file}`)));
  expect(violations).toEqual([]);
});
