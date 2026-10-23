import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
  importFormsExample, importFormsSpecifiers, namedUnit, parseProject, parseWorkspace, repositoryRoot,
  resolveSpecifier, workspaceUnits, type ParsedFile,
} from './typescript-program.js';

const workspace = parseWorkspace();
const units = workspaceUnits();
const packages = units.filter((unit) => unit.directory.startsWith('packages/'));
const apps = units.filter((unit) => unit.directory.startsWith('apps/'));
const inside = (path: string, directory: string) => path.startsWith(`${directory}/`);
const unitOf = (path: string) => units.find((unit) => inside(path, unit.directory));
const filesIn = (directory: string) => workspace.files.filter((file) => inside(file.path, directory));

test('the import extraction sees every form of import', () => {
  const example = 'test/repository/fixtures/import-forms.ts';
  const parsed = parseProject('test/repository/fixtures/tsconfig.json', { files: ['import-forms.ts'] },
    { [example]: importFormsExample });
  const file = parsed.files.find((candidate) => candidate.path === example);
  expect([...new Set(file!.specifiers)].sort()).toEqual([...importFormsSpecifiers].sort());
});

test('the analysis covers the sources and tests of every application and package', () => {
  expect(apps.length).toBeGreaterThan(0);
  expect(packages.length).toBeGreaterThan(0);
  for (const unit of units) {
    expect(filesIn(`${unit.directory}/src`).length, unit.directory).toBeGreaterThan(0);
    expect(filesIn(`${unit.directory}/test`).length, unit.directory).toBeGreaterThan(0);
  }
});

// Verification: Prova degli import tra package business e applicazioni
// Verification: Prova degli import verso package tecnici condivisi
test('package files import nothing from another workspace package or application', () => {
  const violations: string[] = [];
  for (const unit of packages) {
    for (const file of filesIn(unit.directory)) {
      for (const specifier of file.specifiers) {
        const target = resolveSpecifier(file.path, specifier);
        const named = namedUnit(specifier, units);
        if ((specifier.startsWith('.') && !inside(target, unit.directory))
          || (named !== undefined && named.unit !== unit)) violations.push(`${file.path} -> ${specifier}`);
      }
    }
  }
  expect(violations).toEqual([]);
});

// Verification: Prova degli import delle API pubbliche nelle applicazioni
test('applications reach packages only through declared export subpaths', () => {
  const violations: string[] = [];
  for (const app of apps) {
    for (const file of filesIn(app.directory)) {
      for (const specifier of file.specifiers) {
        const named = namedUnit(specifier, units);
        if (specifier.startsWith('#')) violations.push(`${file.path} -> ${specifier} (import alias)`);
        else if (specifier.startsWith('.') && !inside(resolveSpecifier(file.path, specifier), app.directory)) {
          violations.push(`${file.path} -> ${specifier} (relative path outside the application)`);
        } else if (named !== undefined && named.unit !== app && !named.unit.exports.includes(named.subpath)) {
          violations.push(`${file.path} -> ${specifier} (subpath not declared in exports)`);
        }
      }
    }
  }
  expect(violations).toEqual([]);
});

test('no TypeScript configuration declares path aliases', () => {
  const configs = ['', ...units.map((unit) => unit.directory)].flatMap((directory) =>
    readdirSync(join(repositoryRoot, directory)).filter((name) => /^tsconfig.*\.json$/.test(name))
      .map((name) => join(directory, name)));
  expect(configs.length).toBeGreaterThan(0);
  for (const config of configs) {
    expect(readFileSync(join(repositoryRoot, config), 'utf8'), config).not.toMatch(/"paths"\s*:/);
  }
});

const testKinds = ['test/domain/', 'test/application/', 'test/adapters/in/', 'test/adapters/out/'];

/** Production code reached by a test file, directly or through local test files. */
function productionReached(file: ParsedFile, testDirectory: string): string[] {
  const reached: string[] = [];
  const seen = new Set<string>();
  const visit = (current: ParsedFile) => {
    if (seen.has(current.path)) return;
    seen.add(current.path);
    for (const specifier of current.specifiers) {
      if (namedUnit(specifier, units) !== undefined) { reached.push(specifier); continue; }
      if (!specifier.startsWith('.')) continue; // runner, assertion, Node.js modules and npm dependencies
      const target = resolveSpecifier(current.path, specifier).replace(/\.js$/, '.ts');
      if (inside(target, testDirectory)) {
        const local = workspace.files.find((candidate) => candidate.path === target);
        if (local !== undefined) visit(local);
        continue;
      }
      reached.push(target);
    }
  };
  visit(file);
  return reached;
}

// Verification: Prova degli import dei test Domain e Application
test('Domain and Application tests import production code only from their own layers', () => {
  const violations: string[] = [];
  for (const unit of packages) {
    const testDirectory = `${unit.directory}/test`;
    const tests = filesIn(testDirectory).filter((file) => file.path.endsWith('.test.ts'));
    for (const file of tests) {
      const kind = testKinds.find((prefix) => inside(file.path, `${unit.directory}/${prefix.slice(0, -1)}`));
      if (kind === undefined) { violations.push(`${file.path} (not classifiable)`); continue; }
      const allowed = kind === 'test/domain/' ? ['src/domain']
        : kind === 'test/application/' ? ['src/domain', 'src/application'] : undefined;
      if (allowed === undefined) continue;
      for (const target of productionReached(file, testDirectory)) {
        if (!allowed.some((layer) => inside(target, `${unit.directory}/${layer}`))) {
          violations.push(`${file.path} -> ${target}`);
        }
      }
    }
  }
  expect(violations).toEqual([]);
});
