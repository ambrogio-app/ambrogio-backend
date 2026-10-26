// Verification: Prova della coerenza dei modelli vocali registrati
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot } from './source-imports.js';

// «Modelli vocali scaricati nell'immagine del backend»: the archives and SHA-256 hashes recorded in the model
// are the ones the image build downloads and the ones the provenance note of the image lists.
const read = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8');

/** The `archive → hash` pairs of the Markdown table rows that start with an archive name. */
function tableArchives(markdown: string): Map<string, string> {
  const rows = markdown.matchAll(/^\| `([^`]+\.(?:zip|tar\.bz2))` \|.*\| `([0-9a-f]{64})` \|/gm);
  return new Map([...rows].map(([, archive, hash]) => [archive!, hash!]));
}

function sourceElement(): string {
  const contracts = read('system-model/Contracts/ExternalContracts.md');
  const start = contracts.indexOf("### Modelli vocali scaricati nell'immagine del backend\n");
  expect(start).toBeGreaterThanOrEqual(0);
  return contracts.slice(start, contracts.indexOf('\n---', start));
}

function fetchedArchives(): Map<string, string> {
  const script = read('scripts/fetch-speech-models.mjs');
  const entries = script.matchAll(/\{ name: '([^']+)', extension: '([^']+)',\s*sha256: '([0-9a-f]{64})'/g);
  return new Map([...entries].map(([, name, extension, hash]) => [`${name}.${extension}`, hash!]));
}

test('the recorded speech models match the download script and the provenance note', () => {
  const recorded = tableArchives(sourceElement());
  expect(recorded.size).toBe(4);
  expect(fetchedArchives()).toEqual(recorded);
  expect(tableArchives(read('voices/README.md'))).toEqual(recorded);
});
