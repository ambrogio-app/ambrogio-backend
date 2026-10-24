import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { describe, expect, it } from 'vitest';
import { conversationMigrations, migrateConversationArchive } from './migrations.js';
import type { ConversationDatabase } from './schema.js';

const folder = fileURLToPath(new URL('./migrations/', import.meta.url));
type Fingerprint = Readonly<{ name: string; sha256: string }>;
const fingerprints = JSON.parse(readFileSync(join(folder, 'fingerprints.json'), 'utf8')) as Fingerprint[];
const sequence = Object.keys(conversationMigrations);

/** Module specifiers imported or re-exported by a source text, including type-only and dynamic imports. */
function importsOf(source: string): string[] {
  return [...source.matchAll(/\b(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm)]
    .map(match => match[1] ?? match[2] ?? match[3]!);
}

describe('conversation archive migrations', () => {
  // Verification: Prova del registro delle migrazioni
  it('form one strictly ordered sequence, matching the files and the fingerprint register in the same order', () => {
    expect(sequence.length).toBeGreaterThan(0);
    for (const name of sequence) expect(name).toMatch(/^\d{3}_[a-z0-9]+(?:_[a-z0-9]+)*$/);
    expect([...sequence].sort()).toEqual(sequence);
    expect(new Set(sequence).size).toBe(sequence.length);
    expect(fingerprints.map(entry => entry.name)).toEqual(sequence);
    expect(readdirSync(folder).sort()).toEqual([...sequence.map(name => `${name}.ts`), 'fingerprints.json'].sort());
  });

  // Verification: Prova del registro delle migrazioni
  it('keep every registered migration unchanged', () => {
    for (const { name, sha256 } of fingerprints) {
      const content = readFileSync(join(folder, `${name}.ts`));
      expect(createHash('sha256').update(content).digest('hex'), `${name} changed after distribution`).toBe(sha256);
    }
  });

  // Verification: Prova del registro delle migrazioni
  it('import only Kysely, never the current schema types or other code of the product', () => {
    expect(importsOf("import { sql } from 'kysely';\nimport type { X } from '../schema.js';\nconst m = import('./other.js');"))
      .toEqual(['kysely', '../schema.js', './other.js']);
    for (const name of sequence) {
      const imports = importsOf(readFileSync(join(folder, `${name}.ts`), 'utf8'));
      expect(imports.length, name).toBeGreaterThan(0);
      for (const specifier of imports) expect(specifier, name).toMatch(/^kysely(\/[a-z-]+)?$/);
    }
  });

  // Verification: Prova del registro delle migrazioni
  it('refuse to start when a migration already applied is missing from the sequence', async () => {
    const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: new Database(':memory:') }) });
    try {
      await migrateConversationArchive(db);
      await db.insertInto('kysely_migration' as never).values({ name: '999_removed', timestamp: new Date().toISOString() } as never)
        .execute();
      await expect(migrateConversationArchive(db)).rejects.toThrow(/999_removed/);
    } finally {
      await db.destroy();
    }
  });
});
