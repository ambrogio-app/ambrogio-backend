// Central source of the backend's blocking architecture rules («Regole di architettura del backend»).
// Every rule has a stable name, reads the whole import graph of the applications and packages, tests
// and type-only imports included, and reports violations that fail the test suite. An exception is an
// explicit entry of `exceptions`, recorded with its reason in the same contract of the model.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractSpecifiers, namedUnit, repositoryRoot, resolveSpecifier, workspaceSources, workspaceUnits,
  type SourceFile, type WorkspaceUnit,
} from './source-imports.js';

export type ConfigFile = Readonly<{ path: string; text: string }>;
export type ImportGraph = Readonly<{
  files: readonly SourceFile[];
  units: readonly WorkspaceUnit[];
  /** TypeScript configurations of the repository root and of every workspace unit. */
  configs: readonly ConfigFile[];
}>;

export type RuleName =
  | 'package-isolation'
  | 'application-public-exports'
  | 'no-path-aliases'
  | 'layer-test-imports'
  | 'domain-application-own-package';

export type Violation = Readonly<{ rule: RuleName; from: string; to: string }>;
export type Rule = Readonly<{ name: RuleName; check: (graph: ImportGraph) => Violation[] }>;
export type ArchitectureException = Readonly<{ rule: RuleName; from: string; to: string; reason: string }>;

/** Imports admitted despite a rule. Each entry is recorded, with its reason, in the model contract. */
export const exceptions: readonly ArchitectureException[] = [];

const inside = (path: string, directory: string) => path.startsWith(`${directory}/`);
const filesIn = (graph: ImportGraph, directory: string) => graph.files.filter((file) => inside(file.path, directory));
const packagesOf = (graph: ImportGraph) => graph.units.filter((unit) => unit.directory.startsWith('packages/'));
const appsOf = (graph: ImportGraph) => graph.units.filter((unit) => unit.directory.startsWith('apps/'));
const asSource = (path: string) => path.replace(/\.js$/, '.ts');

const packageIsolation: Rule = {
  name: 'package-isolation',
  check: (graph) => packagesOf(graph).flatMap((unit) => filesIn(graph, unit.directory).flatMap((file) =>
    file.specifiers.filter((specifier) => {
      const named = namedUnit(specifier, graph.units);
      return (specifier.startsWith('.') && !inside(resolveSpecifier(file.path, specifier), unit.directory))
        || (named !== undefined && named.unit !== unit);
    }).map((specifier) => ({ rule: 'package-isolation' as const, from: file.path, to: specifier })))),
};

const applicationPublicExports: Rule = {
  name: 'application-public-exports',
  check: (graph) => appsOf(graph).flatMap((app) => filesIn(graph, app.directory).flatMap((file) =>
    file.specifiers.filter((specifier) => {
      const named = namedUnit(specifier, graph.units);
      return specifier.startsWith('#')
        || (specifier.startsWith('.') && !inside(resolveSpecifier(file.path, specifier), app.directory))
        || (named !== undefined && named.unit !== app && !named.unit.exports.includes(named.subpath));
    }).map((specifier) => ({ rule: 'application-public-exports' as const, from: file.path, to: specifier })))),
};

const noPathAliases: Rule = {
  name: 'no-path-aliases',
  check: (graph) => graph.configs.filter((config) => /"paths"\s*:/.test(config.text))
    .map((config) => ({ rule: 'no-path-aliases' as const, from: config.path, to: 'paths' })),
};

/** A test file sits next to the source file it verifies («Suite di test con Vitest»). */
export const isSpec = (path: string) => path.endsWith('.spec.ts');
const isProduction = (path: string, unit: WorkspaceUnit) => inside(path, `${unit.directory}/src`) && !isSpec(path);

/**
 * The source file verified by a `*.spec.ts` file of `src`: the file of the same folder whose name, without `.ts`,
 * opens the name of the test up to a dot, e.g. `turn.spec.ts` and `turn.aspect.spec.ts` verify `turn.ts`.
 */
export function verifiedFile(path: string, known: ReadonlySet<string>): string | undefined {
  const name = path.replace(/(\.integration|\.e2e)?\.spec\.ts$/, '');
  const parts = name.split('/').at(-1)!.split('.');
  const folder = name.slice(0, name.length - parts.join('.').length);
  for (let length = parts.length; length > 0; length -= 1) {
    const candidate = `${folder}${parts.slice(0, length).join('.')}.ts`;
    if (known.has(candidate) && !isSpec(candidate)) return candidate;
  }
  return undefined;
}

const testLayers = ['src/domain', 'src/application', 'src/adapters/in', 'src/adapters/out'] as const;

/** Production code reached by a test file, directly or through the support modules of the unit's `test/` folder. */
function productionReached(graph: ImportGraph, file: SourceFile, unit: WorkspaceUnit): string[] {
  const reached: string[] = [];
  const seen = new Set<string>();
  const visit = (current: SourceFile) => {
    if (seen.has(current.path)) return;
    seen.add(current.path);
    for (const specifier of current.specifiers) {
      if (namedUnit(specifier, graph.units) !== undefined) { reached.push(specifier); continue; }
      if (!specifier.startsWith('.')) continue; // runner, assertion, Node.js modules and npm dependencies
      const target = asSource(resolveSpecifier(current.path, specifier));
      if (inside(target, `${unit.directory}/test`) || isSpec(target)) {
        const local = graph.files.find((candidate) => candidate.path === target);
        if (local !== undefined) visit(local);
        continue;
      }
      reached.push(target);
    }
  };
  visit(file);
  return reached;
}

const layerTestImports: Rule = {
  name: 'layer-test-imports',
  check: (graph) => {
    const known = new Set(graph.files.map((file) => file.path));
    const named = graph.files.filter((file) => file.path.endsWith('.test.ts'))
      .map((file) => ({ rule: 'layer-test-imports' as const, from: file.path, to: '(not a *.spec.ts file)' }));
    return [...named, ...packagesOf(graph).flatMap((unit) =>
      filesIn(graph, unit.directory).filter((file) => isSpec(file.path)).flatMap((file) => {
        const layer = testLayers.find((prefix) => inside(file.path, `${unit.directory}/${prefix}`));
        if (layer === undefined || verifiedFile(file.path, known) === undefined) {
          return [{ rule: 'layer-test-imports' as const, from: file.path, to: '(not classifiable)' }];
        }
        const allowed = layer === 'src/domain' ? ['src/domain']
          : layer === 'src/application' ? ['src/domain', 'src/application'] : undefined;
        if (allowed === undefined) return [];
        return productionReached(graph, file, unit)
          .filter((target) => !allowed.some((prefix) => inside(target, `${unit.directory}/${prefix}`)))
          .map((target) => ({ rule: 'layer-test-imports' as const, from: file.path, to: target }));
      }))];
  },
};

const domainApplicationOwnPackage: Rule = {
  name: 'domain-application-own-package',
  check: (graph) => packagesOf(graph).flatMap((unit) => {
    const known = new Set(graph.files.map((file) => file.path));
    const violations: Violation[] = [];
    const pending = ['src/domain', 'src/application']
      .flatMap((layer) => filesIn(graph, `${unit.directory}/${layer}`)).map((file) => file.path)
      .filter((path) => isProduction(path, unit));
    const seen = new Set<string>();
    while (pending.length > 0) {
      const path = pending.pop()!;
      if (seen.has(path)) continue;
      seen.add(path);
      const file = graph.files.find((candidate) => candidate.path === path)!;
      for (const specifier of file.specifiers) {
        const target = asSource(resolveSpecifier(path, specifier));
        if (!specifier.startsWith('.') || !isProduction(target, unit) || !known.has(target)) {
          violations.push({ rule: 'domain-application-own-package', from: path, to: specifier });
        } else pending.push(target);
      }
    }
    return violations;
  }),
};

export const rules: readonly Rule[] = [
  packageIsolation, applicationPublicExports, noPathAliases, layerTestImports, domainApplicationOwnPackage,
];

const excepted = (violation: Violation, list: readonly ArchitectureException[]) =>
  list.some((entry) => entry.rule === violation.rule && entry.from === violation.from && entry.to === violation.to);

/** Run the rules over the graph and drop the violations admitted by an exception. */
export function analyse(graph: ImportGraph, ruleList: readonly Rule[] = rules,
  exceptionList: readonly ArchitectureException[] = exceptions): Violation[] {
  return ruleList.flatMap((rule) => rule.check(graph)).filter((violation) => !excepted(violation, exceptionList));
}

export const describeViolation = (violation: Violation) => `[${violation.rule}] ${violation.from} -> ${violation.to}`;

/** The import graph of the repository: every TypeScript source and test of the applications and packages. */
export function workspaceGraph(): ImportGraph {
  const units = workspaceUnits();
  const configs = ['', ...units.map((unit) => unit.directory)].flatMap((directory) =>
    readdirSync(join(repositoryRoot, directory)).filter((name) => /^tsconfig.*\.json$/.test(name))
      .map((name) => {
        const path = directory === '' ? name : `${directory}/${name}`;
        return { path, text: readFileSync(join(repositoryRoot, path), 'utf8') };
      }));
  return { files: workspaceSources(), units, configs };
}

/** An in-memory graph for negative fixtures: file paths mapped to their TypeScript source. */
export function fixtureGraph(sources: Readonly<Record<string, string>>, units: readonly WorkspaceUnit[],
  configs: readonly ConfigFile[] = []): ImportGraph {
  const files = Object.entries(sources).map(([path, text]) => ({ path, text, specifiers: extractSpecifiers(text) }));
  return { files, units, configs };
}
