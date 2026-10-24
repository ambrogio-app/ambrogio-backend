import { describe, expect, test } from 'vitest';
import {
  analyse, describeViolation, exceptions, fixtureGraph, rules, workspaceGraph,
  type ArchitectureException, type RuleName,
} from './architecture-rules.js';
import { extractSpecifiers, importFormsExample, importFormsSpecifiers, type WorkspaceUnit } from './source-imports.js';

const workspace = workspaceGraph();

test('the import extraction sees every form of import, type-only ones included, and ignores comments and strings', () => {
  expect([...extractSpecifiers(importFormsExample)].sort()).toEqual([...importFormsSpecifiers].sort());
});

test('the analysis covers the sources and tests of every application and package', () => {
  const units = workspace.units;
  expect(units.some((unit) => unit.directory.startsWith('apps/'))).toBe(true);
  expect(units.some((unit) => unit.directory.startsWith('packages/'))).toBe(true);
  for (const unit of units) {
    const sources = workspace.files.filter((file) => file.path.startsWith(`${unit.directory}/src/`));
    expect(sources.filter((file) => !file.path.endsWith('.spec.ts')).length, unit.directory).toBeGreaterThan(0);
    expect(sources.filter((file) => file.path.endsWith('.spec.ts')).length, unit.directory).toBeGreaterThan(0);
  }
  // Shared test modules live in `test/` only where a unit has them.
  expect(units.some((unit) => workspace.files.some((file) => file.path.startsWith(`${unit.directory}/test/`)))).toBe(true);
  expect(workspace.configs.map((config) => config.path)).toContain('tsconfig.json');
});

// Verification: Prova delle regole di architettura centrali del backend
// Verification: Prova degli import tra package business e applicazioni
// Verification: Prova degli import verso package tecnici condivisi
// Verification: Prova degli import delle API pubbliche nelle applicazioni
// Verification: Prova degli import dei test Domain e Application
// Verification: Prova dell'indipendenza tecnica di Domain e Application
test.each(rules.map((rule) => rule.name))('the workspace respects the rule %s', (name) => {
  const rule = rules.find((candidate) => candidate.name === name)!;
  expect(analyse(workspace, [rule]).map(describeViolation)).toEqual([]);
});

// Negative fixtures: a minimal workspace with one application and two packages.
const units: readonly WorkspaceUnit[] = [
  { directory: 'apps/server', name: 'server', exports: [] },
  { directory: 'packages/conversations', name: '@ambrogio/conversations', exports: ['.', './composition'] },
  { directory: 'packages/memory', name: '@ambrogio/memory', exports: ['.'] },
];

const negativeFixtures: ReadonlyArray<Readonly<{ rule: RuleName; title: string; graph: ReturnType<typeof fixtureGraph> }>> = [
  {
    rule: 'package-isolation', title: 'a type-only import of another package',
    graph: fixtureGraph({ 'packages/conversations/src/adapters/in/route.adapter.ts': "import type { Note } from '@ambrogio/memory';\n" }, units),
  },
  {
    rule: 'package-isolation', title: 'a relative import that leaves the package',
    graph: fixtureGraph({ 'packages/conversations/src/adapters/out/store.adapter.ts': "import { main } from '../../../../../apps/server/src/main.js';\n" }, units),
  },
  {
    rule: 'application-public-exports', title: 'an application importing a subpath not declared in exports',
    graph: fixtureGraph({ 'apps/server/src/main.ts': "import { Turn } from '@ambrogio/conversations/src/domain/turn.js';\n" }, units),
  },
  {
    rule: 'application-public-exports', title: 'an application using an import alias',
    graph: fixtureGraph({ 'apps/server/src/main.spec.ts': "import { main } from '#main';\n" }, units),
  },
  {
    rule: 'no-path-aliases', title: 'a TypeScript configuration with path aliases',
    graph: fixtureGraph({}, units, [{ path: 'tsconfig.json', text: '{ "compilerOptions": { "paths": { "#*": ["./src/*"] } } }' }]),
  },
  {
    rule: 'layer-test-imports', title: 'a Domain test reaching an adapter through a test support module',
    graph: fixtureGraph({
      'packages/conversations/src/domain/turn.ts': 'export class Turn {}\n',
      'packages/conversations/src/domain/turn.spec.ts': "import { store } from '../../test/support/store.js';\n",
      'packages/conversations/test/support/store.ts': "export { store } from '../../src/adapters/out/sqlite/store.adapter.js';\n",
    }, units),
  },
  {
    rule: 'layer-test-imports', title: 'tests not named *.spec.ts, outside the layer folders or without the file they verify',
    graph: fixtureGraph({
      'packages/conversations/test/domain/turn.test.ts': "import { Turn } from '../../src/domain/turn.js';\n",
      'packages/conversations/test/misc/turn.spec.ts': "import { Turn } from '../../src/domain/turn.js';\n",
      'packages/conversations/src/domain/missing.spec.ts': "import { Turn } from './turn.js';\n",
    }, units),
  },
  {
    rule: 'domain-application-own-package', title: 'an Application file importing a Node.js module through a Domain file',
    graph: fixtureGraph({
      'packages/conversations/src/application/start-turn.use-case.ts': "import { Turn } from '../domain/turn.js';\n",
      'packages/conversations/src/adapters/out/note.adapter.ts': "import { randomUUID } from 'node:crypto';\nexport const Turn = randomUUID;\n",
    }, units),
  },
];

describe('negative fixtures', () => {
  test('every rule has at least one negative fixture', () => {
    expect(new Set(negativeFixtures.map((fixture) => fixture.rule))).toEqual(new Set(rules.map((rule) => rule.name)));
  });

  test.each(negativeFixtures.map((fixture) => [fixture.rule, fixture.title, fixture] as const))(
    '%s fails on %s', (rule, _title, fixture) => {
      const violations = analyse(fixture.graph);
      expect(violations.length).toBeGreaterThan(0);
      expect(new Set(violations.map((violation) => violation.rule))).toEqual(new Set([rule]));
    });
});

describe('exceptions', () => {
  test('every recorded exception names an existing rule, one import and a reason', () => {
    const names = new Set<string>(rules.map((rule) => rule.name));
    for (const entry of exceptions) {
      expect(names.has(entry.rule), entry.rule).toBe(true);
      expect(entry.from.trim(), entry.rule).not.toBe('');
      expect(entry.to.trim(), entry.rule).not.toBe('');
      expect(entry.reason.trim(), `${entry.rule} ${entry.from}`).not.toBe('');
    }
  });

  test('an exception suppresses only the import it names', () => {
    const graph = fixtureGraph({
      'packages/conversations/src/adapters/out/note.adapter.ts': "import type { Note } from '@ambrogio/memory';\nimport { Fact } from '@ambrogio/memory';\n",
    }, units);
    const fixtureExceptions: readonly ArchitectureException[] = [{
      rule: 'package-isolation', from: 'packages/conversations/src/adapters/out/note.adapter.ts', to: '@ambrogio/memory', reason: 'fixture',
    }];
    expect(analyse(graph).map(describeViolation)).toEqual(['[package-isolation] packages/conversations/src/adapters/out/note.adapter.ts -> @ambrogio/memory']);
    expect(analyse(graph, rules, fixtureExceptions)).toEqual([]);
    const other = fixtureGraph({ 'packages/conversations/src/adapters/out/other.adapter.ts': "import { Fact } from '@ambrogio/memory';\n" }, units);
    expect(analyse(other, rules, fixtureExceptions).map(describeViolation))
      .toEqual(['[package-isolation] packages/conversations/src/adapters/out/other.adapter.ts -> @ambrogio/memory']);
  });
});
