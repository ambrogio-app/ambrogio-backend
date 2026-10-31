// Static checks of the Domain model, of the turn repository and of the read contracts of «Conversazioni»,
// read as text without comments and literals.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { extractSpecifiers, maskSource, repositoryRoot } from './source-imports.js';

const sources = join(repositoryRoot, 'packages/conversations/src');
const read = (path: string) => readFileSync(join(sources, path), 'utf8');
const code = (path: string) => maskSource(read(path)).text;
const filesIn = (folder: string, suffix = '.ts') => readdirSync(join(sources, folder), { recursive: true, encoding: 'utf8' })
  .map((name) => `${folder}/${name.split('\\').join('/')}`)
  .filter((name) => name.endsWith(suffix) && !name.endsWith('.spec.ts'));

type ClassFacts = Readonly<{
  name: string; body: string; extendsClause: string | undefined; constructor: string | undefined;
  statics: string[]; fields: string[]; setters: string[];
}>;

/** The top-level classes of a source with the facts the Domain contract talks about. */
function classesOf(text: string): ClassFacts[] {
  const classes: ClassFacts[] = [];
  for (const match of text.matchAll(/export class (\w+)(\s+extends\s+[\w.]+)?[^{]*\{/g)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (depth > 0 && index < text.length) {
      if (text[index] === '{') depth += 1;
      else if (text[index] === '}') depth -= 1;
      index += 1;
    }
    const body = text.slice(match.index + match[0].length, index - 1);
    // Members at the first nesting level of the class body.
    let level = 0;
    let top = '';
    for (const character of body) {
      if (character === '{') level += 1;
      if (level === 0) top += character;
      if (character === '}') level -= 1;
    }
    classes.push({
      name: match[1]!, body, extendsClause: match[2]?.trim(),
      constructor: /^\s*((?:private|protected|public)\s+)?constructor\s*\(/m.exec(top)?.[1]?.trim() ?? (/^\s*constructor\s*\(/m.test(top) ? 'public' : undefined),
      statics: [...top.matchAll(/^\s*static\s+(\w+)\s*\(/gm)].map((member) => member[1]!),
      fields: [...top.matchAll(/^\s*((?:readonly\s+)?(?:public\s+|private\s+|protected\s+)?(?:readonly\s+)?#?\w+)\s*[:=;]/gm)]
        .map((member) => member[1]!.trim()),
      setters: [...top.matchAll(/^\s*set\s+(\w+)\s*\(/gm)].map((member) => member[1]!),
    });
  }
  return classes;
}

// The project error of `src/domain/project-error.ts` is the error class of the project, not a Domain object.
const domainFiles = filesIn('domain').filter((file) => !file.endsWith('/project-error.ts'));
const domainClasses = domainFiles.flatMap((file) => classesOf(code(file)).map((facts) => ({ file, ...facts })));
const valueObjects = ['ConversationId', 'TurnId'];
const roots = ['Turn'];

test('the class reading recognizes constructors, entry points, fields and setters', () => {
  const [facts] = classesOf(maskSource([
    'export class Sample extends Base {',
    '  readonly #value: string;',
    '  public open = 1;',
    '  private constructor(value: string) { super(); this.#value = value; }',
    '  static create(value: string): Sample { return new Sample(value); }',
    '  set value(next: string) { if (next) { this.#value = next; } }',
    '}',
  ].join('\n')).text);
  expect(facts).toMatchObject({ name: 'Sample', extendsClause: 'extends Base', constructor: 'private',
    statics: ['create'], fields: ['readonly #value', 'public open'], setters: ['value'] });
});

// Verification: Prova della struttura TypeScript del Domain
test('Domain classes have private constructors, explicit entry points and private JavaScript fields', () => {
  expect(domainClasses.map((facts) => facts.name).sort()).toEqual([...roots, ...valueObjects].sort());
  for (const facts of domainClasses) {
    expect(facts.constructor, facts.name).toBe('private');
    expect(facts.extendsClause, facts.name).toBeUndefined();
    expect(facts.setters, facts.name).toEqual([]);
    for (const field of facts.fields) expect(field, `${facts.name}: ${field}`).toMatch(/^(readonly\s+)?#\w+$/);
  }
  for (const name of roots) {
    const facts = domainClasses.find((candidate) => candidate.name === name)!;
    expect(facts.statics.sort(), name).toEqual(['create', 'rehydrate']);
    expect(facts.body, name).not.toMatch(/\bsnapshot\s*\(/);
  }
  for (const name of valueObjects) {
    const facts = domainClasses.find((candidate) => candidate.name === name)!;
    expect(facts.statics.filter((member) => member !== 'isValid'), name).toEqual(['create']);
    for (const field of facts.fields) expect(field, name).toMatch(/^readonly #\w+$/);
    expect(facts.body, name).toMatch(new RegExp(`\\bequals\\(other: ${name}\\): boolean`));
  }
});

// Verification: Prova della struttura TypeScript del Domain
test('inbound adapters never import identity classes, and use cases carry identifiers as plain strings', () => {
  for (const file of filesIn('adapters/in')) {
    const imports = extractSpecifiers(read(file));
    expect(imports.filter((specifier) => /domain\/identities\.js$/.test(specifier)), file).toEqual([]);
  }
  for (const file of filesIn('application', '.use-case.ts')) {
    const text = code(file);
    for (const match of text.matchAll(/export type \w+(?:Input|Success|Result)\b[^;]*;/g)) {
      expect(match[0], file).not.toMatch(/\b(ConversationId|TurnId)\b/);
    }
  }
});

// Verification: Prova delle responsabilità del repository del turno
test('the turn repository stores the Domain state without deciding it', () => {
  const adapter = code('adapters/out/postgres/postgres-turn-repository.adapter.ts');
  const mapper = code('adapters/out/postgres/postgres-turn-mapper.ts');
  for (const [name, text] of [['adapter', adapter], ['mapper', mapper]] as const) {
    expect(text, name).not.toMatch(/\.(answer|fail|interrupt)\s*\(/);
    expect(text, name).not.toMatch(/Turn\.create\s*\(|randomUUID|\.next\s*\(\s*\)|\bnew Date\s*\(\s*\)|Date\.now\s*\(|\.now\s*\(\s*\)/);
  }
  expect(adapter).not.toMatch(/Turn\.rehydrate\s*\(/);
  const writeMapping = mapper.slice(mapper.indexOf('export function conclusionColumns'));
  expect(writeMapping).not.toMatch(/Turn\.(rehydrate|create)\s*\(/);
  expect(writeMapping).toMatch(/turn\.status/);
});

const ports = filesIn('application', '.port.ts');

// Verification: Prova della separazione dei contratti di lettura
test('read contracts, the lookup port and the turn repository stay separate', () => {
  for (const file of ['application/conversation-history-read.port.ts', 'application/conversation-list-read.port.ts',
    'application/get-conversation/get-conversation.use-case.ts', 'application/list-conversations/list-conversations.use-case.ts']) {
    const imports = extractSpecifiers(read(file));
    expect(imports.filter((specifier) => /domain\/(turn\/turn|identities)\.js$|turn-repository\.port\.js$/.test(specifier)), file)
      .toEqual([]);
  }
  const begin = extractSpecifiers(read('application/begin-turn/begin-turn.use-case.ts'));
  expect(begin).toContain('../conversation-lookup.port.js');
  expect(begin.filter((specifier) => /-read\.port\.js$/.test(specifier))).toEqual([]);
  const repository = code('application/turn-repository.port.ts');
  expect([...repository.matchAll(/^\s*(\w+)\(/gm)].map((match) => match[1]).sort())
    .toEqual(['admit', 'find', 'findPending', 'saveConclusion']);
  expect(ports).toEqual(expect.arrayContaining(['application/conversation-lookup.port.ts', 'application/turn-repository.port.ts']));
});

// Verification: Prova delle porte senza streaming dell'archivio
test('only the reply production port delivers incrementally, as Application values', () => {
  const incremental = /\b(AsyncIterable|AsyncIterator|AsyncGenerator|ReadableStream|Readable|Stream)\b|from 'node:stream'|\bCursor\b/;
  const streaming = ports.filter((file) => incremental.test(code(file)));
  expect(streaming).toEqual(['application/produce-conversation-reply.port.ts']);
  const reply = code('application/produce-conversation-reply.port.ts');
  expect(reply).toMatch(/AsyncIterable<ReplyPart>/);
  expect(reply).not.toMatch(/ReadableStream|node:stream|kysely/);
});
