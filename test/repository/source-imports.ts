// Reads the module specifiers of the repository's TypeScript sources as text.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const toRelative = (absolute: string) => relative(repositoryRoot, absolute).split(sep).join('/');

/**
 * Remove line and block comments and replace every string or template literal with a numbered
 * placeholder, so that text inside literals and comments never looks like an import.
 */
export function maskSource(source: string): { text: string; literals: string[] } {
  let text = '';
  const literals: string[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    const next = source[index + 1];
    if (character === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
    } else if (character === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const comment = source.slice(index, end === -1 ? source.length : end + 2);
      text += comment.replace(/[^\n]/g, ' ');
      index += comment.length;
    } else if (character === "'" || character === '"' || character === '`') {
      let end = index + 1;
      while (end < source.length && source[end] !== character) end += source[end] === '\\' ? 2 : 1;
      literals.push(character === '`' ? '' : source.slice(index + 1, end));
      text += `${character === '`' ? '`' : "'"}${literals.length - 1}${character === '`' ? '`' : "'"}`;
      index = end + 1;
    } else {
      text += character;
      index += 1;
    }
  }
  return { text, literals };
}

// `import … from '…'`, `export … from '…'` (including `import type` and `export type`),
// side-effect `import '…'` and literal `import('…')`, matched on the masked text.
const fromClause = /\b(?:import|export)\b[^;'`]*?\bfrom\s*'(\d+)'/g;
const sideEffect = /(?:^|[;\n{}])\s*import\s*'(\d+)'/g;
const dynamicImport = /\bimport\s*\(\s*'(\d+)'\s*\)/g;

/** The module specifiers of a TypeScript source, read as text. */
export function extractSpecifiers(source: string): string[] {
  const { text, literals } = maskSource(source);
  const specifiers: string[] = [];
  for (const pattern of [fromClause, sideEffect, dynamicImport]) {
    for (const match of text.matchAll(pattern)) specifiers.push(literals[Number(match[1])]!);
  }
  return [...new Set(specifiers)];
}

export type SourceFile = Readonly<{ path: string; text: string; specifiers: readonly string[] }>;

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'dist' ? [] : walk(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** All TypeScript sources of the applications and packages, tests included, without `dist/` and `node_modules/`. */
export function workspaceSources(): readonly SourceFile[] {
  return workspaceUnits().flatMap((unit) => walk(join(repositoryRoot, unit.directory)))
    .map((absolute) => {
      const text = readFileSync(absolute, 'utf8');
      return { path: toRelative(absolute), text, specifiers: extractSpecifiers(text) };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
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

/** Sample source with every form of import the extraction recognizes, plus text that only looks like an import. */
export const importFormsExample = [
  "import { value } from './value-import.js';",
  "import type { Shape } from './type-import.js';",
  "import {",
  "  first,",
  "  type Second,",
  "} from './multiline-import.js';",
  "import * as all from './namespace-import.js';",
  "import './side-effect-import.js';",
  "export { other } from './re-export.js';",
  "export * from './star-re-export.js';",
  "export type { OtherShape } from './type-re-export.js';",
  "const loaded = import('./dynamic-import.js');",
  "type Loaded = typeof import('./import-type-query.js');",
  "// import commented from './line-comment.js';",
  "/* export { hidden } from './block-comment.js'; */",
  "const text = \"see https://example.org // import quoted from './string.js'\";",
  'export { value, first, all, loaded, text };',
  'export type { Shape, Second, Loaded };',
].join('\n');

export const importFormsSpecifiers = [
  './value-import.js', './type-import.js', './multiline-import.js', './namespace-import.js',
  './side-effect-import.js', './re-export.js', './star-re-export.js', './type-re-export.js',
  './dynamic-import.js', './import-type-query.js',
];
