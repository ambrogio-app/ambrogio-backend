import { expect, test } from 'vitest';
import { maskSource, resolveSpecifier, workspaceSources, workspaceUnits, type SourceFile } from './source-imports.js';

// «Forma del tipo Result»
const resultShape = 'Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>';
const normalize = (text: string) => text.replace(/\s+/g, '');

type Facts = { declarations: string[]; invalid: string[]; references: number; imports: string[] };

/** The declaration that starts at `start`, up to its `;` or its closing brace outside nested brackets. */
function statementAt(text: string, start: number): string {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]!;
    if ('{(['.includes(character) || (character === '<' && depth >= 0)) depth += 1;
    else if ('})]>'.includes(character)) {
      depth -= 1;
      if (depth === 0 && character === '}' && !/^\s*type\b/.test(text.slice(start))) return text.slice(start, index + 1).trim();
    } else if (character === ';' && depth === 0) return text.slice(start, index + 1).trim();
  }
  return text.slice(start).trim();
}

/** Declarations, references and imports of the name `Result`, read as text without comments and literals. */
export function resultFacts(source: string): Facts {
  const { text, literals } = maskSource(source);
  const facts: Facts = { declarations: [], invalid: [], references: 0, imports: [] };
  const declarations = /(^|[;\n}])(\s*(?:export\s+)?(?:declare\s+)?)((?:type|interface|class|enum|namespace)\s+Result\b)/g;
  for (const match of text.matchAll(declarations)) {
    const declaration = statementAt(text, match.index + match[1]!.length + match[2]!.length);
    const alias = /^type\s+Result\s*<\s*T\s*,\s*E\s*>\s*=([\s\S]*);$/.exec(declaration);
    const valid = alias !== null && normalize(alias[1]!) === normalize(resultShape);
    (valid ? facts.declarations : facts.invalid).push(declaration);
  }
  facts.references = [...text.matchAll(/\bResult\s*</g)].length + [...text.matchAll(/\.\s*Result\b/g)].length
    - facts.declarations.length - facts.invalid.length;
  for (const match of text.matchAll(/\b(?:import|export)\b([^;'`]*?)\bfrom\s*'(\d+)'/g)) {
    const clause = match[1]!;
    const specifier = literals[Number(match[2])]!;
    if (/[{,]\s*(?:type\s+)?Result\b/.test(clause)) facts.imports.push(specifier);
    const namespace = /\*\s*as\s+(\w+)/.exec(clause);
    if (namespace !== null && new RegExp(`\\b${namespace[1]}\\s*\\.\\s*Result\\b`).test(text)) facts.imports.push(specifier);
  }
  for (const match of text.matchAll(/\bimport\s*\(\s*'(\d+)'\s*\)\s*\.\s*Result\b/g)) facts.imports.push(literals[Number(match[1])]!);
  return facts;
}

test('the Result reading recognizes declarations, references and every way to import the name', () => {
  const facts = resultFacts([
    "import { Turn, type Result } from './named.js';",
    "import type { Result as Outcome } from './renamed.js';",
    "import * as domain from './namespace.js';",
    "export type { Result } from './re-export.js';",
    "type Other = import('./query.js').Result<1, 2>;",
    'type Local = domain.Result<1, 2>;',
    '// type Result<T, E> = { ok: true };',
    "const text = 'type Result<T, E> = unknown;';",
    `export type Result<T, E> = ${resultShape};`,
    'export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };',
    'interface Result { ok: boolean }',
  ].join('\n'));
  expect(facts.imports.sort()).toEqual(['./named.js', './namespace.js', './query.js', './re-export.js', './renamed.js']);
  expect(facts.declarations).toHaveLength(1);
  expect(facts.invalid).toHaveLength(2);
  expect(facts.references).toBeGreaterThan(0);
});

// Verification: Prova delle definizioni locali di Result
test('each package that uses Result declares it locally with the specified shape', () => {
  const sources = workspaceSources();
  const violations: string[] = [];
  let checkedPackages = 0;
  for (const unit of workspaceUnits().filter((candidate) => candidate.directory.startsWith('packages/'))) {
    const files: SourceFile[] = sources.filter((file) => file.path.startsWith(`${unit.directory}/src/`));
    const byPath = new Map(files.map((file) => [file.path, resultFacts(file.text)]));
    const declaring = new Set([...byPath].filter(([, facts]) => facts.declarations.length > 0).map(([path]) => path));
    const uses = [...byPath.values()].some((facts) => facts.references > 0 || facts.imports.length > 0);
    if (uses) checkedPackages += 1;
    if (uses && declaring.size === 0) violations.push(`${unit.directory} uses Result without declaring it`);
    for (const [path, facts] of byPath) {
      for (const declaration of facts.invalid) violations.push(`${path}: ${declaration}`);
      for (const specifier of facts.imports) {
        const target = resolveSpecifier(path, specifier).replace(/\.js$/, '.ts');
        if (!specifier.startsWith('.') || !declaring.has(target)) violations.push(`${path} imports Result from ${specifier}`);
      }
    }
  }
  expect(checkedPackages).toBeGreaterThan(0);
  expect(violations).toEqual([]);
});
