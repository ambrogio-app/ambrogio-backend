import { expect, test } from 'vitest';
import { SyntaxKind } from 'typescript/unstable/ast';
import { parseWorkspace, resolveSpecifier, workspaceUnits, type ParsedFile } from './typescript-program.js';

// «Forma del tipo Result»
const resultShape = 'Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>';
const normalize = (text: string) => text.replace(/\s+/g, '');

const declarationKinds = new Set([SyntaxKind.TypeAliasDeclaration, SyntaxKind.InterfaceDeclaration,
  SyntaxKind.ClassDeclaration, SyntaxKind.EnumDeclaration, SyntaxKind.ModuleDeclaration]);

type Facts = { declarations: string[]; invalid: string[]; references: number; imports: string[] };

function facts(file: ParsedFile): Facts {
  const result: Facts = { declarations: [], invalid: [], references: 0, imports: [] };
  const text: string = file.sourceFile.text;
  const namespaces = new Map<string, string>();
  const qualifiers: string[] = [];
  const visit = (node: any): void => {
    if (declarationKinds.has(node.kind) && node.name?.text === 'Result') {
      const valid = node.kind === SyntaxKind.TypeAliasDeclaration
        && node.typeParameters?.map((parameter: any) => parameter.name.text).join(',') === 'T,E'
        && normalize(text.slice(node.type.pos, node.type.end)) === normalize(resultShape);
      (valid ? result.declarations : result.invalid).push(text.slice(node.pos, node.end).trim());
    }
    if (node.kind === SyntaxKind.TypeReference) {
      const name = node.typeName;
      if (name.kind === SyntaxKind.Identifier && name.text === 'Result') result.references += 1;
      if (name.kind === SyntaxKind.QualifiedName && name.right.text === 'Result') {
        result.references += 1;
        qualifiers.push(name.left.text);
      }
    }
    if (node.kind === SyntaxKind.ImportType && node.qualifier !== undefined
      && /(^|\.)Result$/.test(text.slice(node.qualifier.pos, node.qualifier.end).trim())) {
      result.references += 1;
      result.imports.push(node.argument.literal.text);
    }
    if (node.kind === SyntaxKind.ImportSpecifier || node.kind === SyntaxKind.ExportSpecifier) {
      if ((node.propertyName ?? node.name).text === 'Result') {
        let statement = node.parent;
        while (statement.moduleSpecifier === undefined && statement.parent !== undefined) statement = statement.parent;
        if (statement.moduleSpecifier !== undefined) result.imports.push(statement.moduleSpecifier.text);
      }
    }
    if (node.kind === SyntaxKind.NamespaceImport) {
      // `namespace.Result` reaches Result through this import: its source is checked like a named import.
      namespaces.set(node.name.text, node.parent.parent.moduleSpecifier.text);
    }
    node.forEachChild(visit);
  };
  file.sourceFile.forEachChild(visit);
  for (const qualifier of qualifiers) result.imports.push(namespaces.get(qualifier) ?? `unknown namespace ${qualifier}`);
  return result;
}

// Verification: Prova delle definizioni locali di Result
test('each package that uses Result declares it locally with the specified shape', () => {
  const workspace = parseWorkspace();
  const violations: string[] = [];
  let checkedPackages = 0;
  for (const unit of workspaceUnits().filter((candidate) => candidate.directory.startsWith('packages/'))) {
    const files = workspace.files.filter((file) => file.path.startsWith(`${unit.directory}/src/`));
    const byPath = new Map(files.map((file) => [file.path, facts(file)]));
    const declaring = new Set([...byPath].filter(([, fileFacts]) => fileFacts.declarations.length > 0).map(([path]) => path));
    const uses = [...byPath.values()].some((fileFacts) => fileFacts.references > 0 || fileFacts.imports.length > 0);
    if (uses) checkedPackages += 1;
    if (uses && declaring.size === 0) violations.push(`${unit.directory} uses Result without declaring it`);
    for (const [path, fileFacts] of byPath) {
      for (const declaration of fileFacts.invalid) violations.push(`${path}: ${declaration}`);
      for (const specifier of fileFacts.imports) {
        const target = resolveSpecifier(path, specifier).replace(/\.js$/, '.ts');
        if (!specifier.startsWith('.') || !declaring.has(target)) violations.push(`${path} imports Result from ${specifier}`);
      }
    }
  }
  expect(checkedPackages).toBeGreaterThan(0);
  expect(violations).toEqual([]);
});
