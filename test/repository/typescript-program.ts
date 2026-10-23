// Reads the repository's TypeScript sources through the compiler API of the `typescript` devDependency.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API } from 'typescript/unstable/sync';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** A source file of the program as the compiler parsed it. */
export type ParsedFile = Readonly<{
  /** Path relative to the repository root, with `/` separators. */
  path: string;
  /** Module specifiers of imports, `import type`, re-exports, `require` and dynamic imports. */
  specifiers: readonly string[];
  // The compiler's syntax tree; its shape belongs to the unstable API.
  sourceFile: any;
}>;

export type Diagnostic = Readonly<{ path: string; text: string }>;

export type Program = Readonly<{
  files: readonly ParsedFile[];
  diagnostics: readonly Diagnostic[];
}>;

const toRelative = (absolute: string) => relative(repositoryRoot, absolute).split(sep).join('/');

/**
 * Parse a project described by in-memory files: a `tsconfig.json` at `configPath` and any extra
 * sources. Paths are relative to the repository root; real files are read from disk.
 */
export function parseProject(
  configPath: string,
  config: unknown,
  virtualFiles: Readonly<Record<string, string>> = {},
  withDiagnostics = false,
): Program {
  const files = new Map<string, string>([[join(repositoryRoot, configPath), JSON.stringify(config)]]);
  for (const [path, text] of Object.entries(virtualFiles)) files.set(join(repositoryRoot, path), text);
  const api = new API({
    cwd: repositoryRoot,
    fs: {
      readFile: (fileName) => files.get(fileName) ?? undefined,
      fileExists: (fileName) => (files.has(fileName) ? true : undefined),
    },
  });
  try {
    const configFile = join(repositoryRoot, configPath);
    const project = api.updateSnapshot({ openProjects: [configFile] }).getProject(configFile);
    if (project === undefined) throw new Error(`The compiler did not open ${configPath}`);
    const parsed: ParsedFile[] = [];
    for (const fileName of project.program.getSourceFileNames()) {
      if (!fileName.startsWith(repositoryRoot + sep)) continue; // bundled libraries
      const path = toRelative(fileName);
      if (path.split('/').includes('node_modules')) continue;
      const sourceFile = project.program.getSourceFile(fileName);
      if (sourceFile === undefined) throw new Error(`The compiler did not parse ${path}`);
      parsed.push({ path, sourceFile, specifiers: sourceFile.imports.map((node: { text: string }) => node.text) });
    }
    const diagnostics = withDiagnostics
      ? [...project.program.getSyntacticDiagnostics(), ...project.program.getSemanticDiagnostics(),
        ...project.program.getProgramDiagnostics()]
        .map((diagnostic) => ({ path: diagnostic.fileName ? toRelative(diagnostic.fileName) : '', text: diagnostic.text }))
      : [];
    return { files: parsed.sort((a, b) => a.path.localeCompare(b.path)), diagnostics };
  } finally {
    api.close();
  }
}

/** All TypeScript sources of the applications and packages, tests included, without `dist/`. */
export function parseWorkspace(): Program {
  return parseProject('tsconfig.repository-analysis.json', {
    extends: './tsconfig.json',
    include: ['apps/**/*.ts', 'packages/**/*.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  });
}

/** Resolve a relative specifier of `from` to a repository path; other specifiers are returned unchanged. */
export function resolveSpecifier(from: string, specifier: string): string {
  if (!specifier.startsWith('.')) return specifier;
  return toRelative(resolve(repositoryRoot, dirname(from), specifier));
}

export type WorkspaceUnit = Readonly<{ directory: string; name?: string; exports: readonly string[] }>;

/** The workspace members declared in `pnpm-workspace.yaml` as `apps/*` and `packages/*`. */
export function workspaceUnits(): readonly WorkspaceUnit[] {
  const units: WorkspaceUnit[] = [];
  for (const parent of ['apps', 'packages']) {
    for (const entry of readdirSync(join(repositoryRoot, parent), { withFileTypes: true })) {
      const manifest = join(repositoryRoot, parent, entry.name, 'package.json');
      if (!entry.isDirectory() || !existsSync(manifest)) continue;
      const json = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string; exports?: Record<string, unknown> };
      units.push({ directory: `${parent}/${entry.name}`, ...(json.name ? { name: json.name } : {}),
        exports: Object.keys(json.exports ?? {}) });
    }
  }
  return units;
}

/** The workspace unit named by a bare specifier, with the subpath that follows the name. */
export function namedUnit(specifier: string, units: readonly WorkspaceUnit[]) {
  for (const unit of units) {
    if (unit.name === undefined) continue;
    if (specifier === unit.name) return { unit, subpath: '.' };
    if (specifier.startsWith(`${unit.name}/`)) return { unit, subpath: `.${specifier.slice(unit.name.length)}` };
  }
  return undefined;
}

/**
 * Source used to check that the import extraction sees every form of import. Each specifier
 * names the form it is written with.
 */
export const importFormsExample = [
  "import { value } from './value-import.js';",
  "import type { Shape } from './type-import.js';",
  "import './side-effect-import.js';",
  "export { other } from './re-export.js';",
  "export * from './star-re-export.js';",
  "export type { OtherShape } from './type-re-export.js';",
  "import legacy = require('./require-import.js');",
  "const loaded = import('./dynamic-import.js');",
  "type Loaded = typeof import('./import-type-query.js');",
  "// import commented from './comment.js';",
  "const text = \"import quoted from './string.js'\";",
  'export { value, legacy, loaded, text };',
  'export type { Shape, Loaded };',
].join('\n');

export const importFormsSpecifiers = [
  './value-import.js', './type-import.js', './side-effect-import.js', './re-export.js',
  './star-re-export.js', './type-re-export.js', './require-import.js', './dynamic-import.js',
  './import-type-query.js',
];
