// Line-based reader for the YAML subset used by the repository's workflows: block mappings,
// block sequences, flow sequences, quoted and plain scalars, block scalars and comments.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot } from './source-imports.js';

export type Yaml = string | Yaml[] | { [key: string]: Yaml };

type Line = { indent: number; text: string; raw: string };

function stripComment(text: string): string {
  let quote: string | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== undefined) { if (character === quote) quote = undefined; continue; }
    if (character === "'" || character === '"') quote = character;
    else if (character === '#' && (index === 0 || /\s/.test(text[index - 1]!))) return text.slice(0, index).trimEnd();
  }
  return text.trimEnd();
}

function scalar(text: string): Yaml {
  const value = text.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((item) => scalar(item) as string);
  }
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }
  return value;
}

/** Split `key: value` outside quotes; returns undefined for a line that is not a mapping entry. */
function entry(text: string): [string, string] | undefined {
  const match = /^([^'"\s][^:]*?|'[^']*'|"[^"]*"):(?:\s+(.*))?$/.exec(text);
  if (match === null) return undefined;
  return [scalar(match[1]!) as string, match[2] ?? ''];
}

export function parseYaml(source: string): Yaml {
  const lines: Line[] = source.split('\n').map((raw) => ({ raw, indent: raw.length - raw.trimStart().length,
    text: stripComment(raw.trim()) }));
  let position = 0;
  const skipBlank = () => { while (position < lines.length && lines[position]!.text === '') position += 1; };

  const blockScalar = (parentIndent: number): string => {
    const collected: string[] = [];
    let indent: number | undefined;
    while (position < lines.length) {
      const line = lines[position]!;
      if (line.raw.trim() !== '' && line.indent <= parentIndent) break;
      if (line.raw.trim() !== '') indent ??= line.indent;
      collected.push(line.raw.slice(indent ?? 0));
      position += 1;
    }
    return `${collected.join('\n').trimEnd()}\n`;
  };

  const value = (rest: string, parentIndent: number): Yaml => {
    if (rest === '|' || rest === '>') return blockScalar(parentIndent);
    if (rest !== '') return scalar(rest);
    skipBlank();
    const next = lines[position];
    if (next === undefined || next.indent <= parentIndent && !(next.indent === parentIndent && next.text.startsWith('- '))) return '';
    return node(next.indent);
  };

  const node = (indent: number): Yaml => {
    skipBlank();
    if (lines[position]!.text.startsWith('- ') || lines[position]!.text === '-') {
      const items: Yaml[] = [];
      while (true) {
        skipBlank();
        const line = lines[position];
        if (line === undefined || line.indent !== indent || !(line.text.startsWith('- ') || line.text === '-')) break;
        const rest = line.text.slice(1).trim();
        const itemIndent = indent + line.raw.trimStart().indexOf(rest === '' ? '-' : rest);
        const pair = entry(rest);
        if (pair === undefined) { position += 1; items.push(rest === '' ? value('', indent) : scalar(rest)); continue; }
        // A mapping that starts on the dash line continues on lines indented like its first key.
        lines[position] = { ...line, indent: itemIndent, text: rest };
        items.push(node(itemIndent));
      }
      return items;
    }
    const mapping: { [key: string]: Yaml } = {};
    while (true) {
      skipBlank();
      const line = lines[position];
      if (line === undefined || line.indent !== indent || line.text.startsWith('- ')) break;
      const pair = entry(line.text);
      if (pair === undefined) throw new Error(`Unsupported YAML line ${position + 1}: ${line.raw}`);
      position += 1;
      mapping[pair[0]] = value(pair[1], indent);
    }
    return mapping;
  };

  const document = node(0);
  skipBlank();
  if (position < lines.length) throw new Error(`Unparsed YAML from line ${position + 1}: ${lines[position]!.raw}`);
  return document;
}

export type Workflow = Readonly<{ path: string; text: string; document: { [key: string]: any } }>;

export function readWorkflow(name: string): Workflow {
  const path = `.github/workflows/${name}`;
  const text = readFileSync(join(repositoryRoot, path), 'utf8');
  return { path, text, document: parseYaml(text) as { [key: string]: any } };
}
