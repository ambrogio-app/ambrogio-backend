import { writeConfigFile } from '../../support/config-fixture.js';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConversationConfig } from '../../../src/adapters/out/conversation-config.js';

const directories: string[] = [];

async function configFile(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-conversation-config-'));
  directories.push(directory);
  const filename = join(directory, 'conversations.ts');
  await writeConfigFile(filename, contents);
  return filename;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('conversation TypeScript configuration', () => {
  it('uses defaults for absent fields and accepts explicit page limits', async () => {
    expect(await loadConversationConfig(await configFile('{}'))).toEqual({
      listPageSize: 20, maxListPageSize: 100, language: 'en', timeZone: 'UTC',
    });
    expect(await loadConversationConfig(await configFile('{"listPageSize": 2, "maxListPageSize": 3}'))).toEqual({
      listPageSize: 2, maxListPageSize: 3, language: 'en', timeZone: 'UTC',
    });
    expect(await loadConversationConfig(await configFile('{"listPageSize": 110, "maxListPageSize": 120}'))).toEqual({
      listPageSize: 110, maxListPageSize: 120, language: 'en', timeZone: 'UTC',
    });
  });

  it('selects English or Italian and falls back to English for an unsupported language', async () => {
    expect((await loadConversationConfig(await configFile('{"language":"en"}'))).language).toBe('en');
    expect((await loadConversationConfig(await configFile('{"language":"it"}'))).language).toBe('it');
    expect((await loadConversationConfig(await configFile('{"language":"fr"}'))).language).toBe('en');
  });

  // Verification: Prova del fuso orario configurato
  it('uses UTC without timeZone, keeps a valid one and rejects invalid ones', async () => {
    expect((await loadConversationConfig(await configFile('{}'))).timeZone).toBe('UTC');
    expect((await loadConversationConfig(await configFile('{"timeZone":"Europe/Rome"}'))).timeZone)
      .toBe('Europe/Rome');
    for (const timeZone of [7, '', 'Mars/Olympus']) {
      await expect(loadConversationConfig(await configFile(JSON.stringify({ timeZone }))))
        .rejects.toThrow('Invalid conversation time zone');
    }
  });

  it('keeps a supplied archive path and rejects an unusable one', async () => {
    expect((await loadConversationConfig(await configFile('{"archivePath":"/tmp/ambrogio.sqlite"}')))
      .archivePath).toBe('/tmp/ambrogio.sqlite');
    for (const archivePath of ['', '  ', 7, null]) {
      await expect(loadConversationConfig(await configFile(JSON.stringify({ archivePath })))).rejects.toThrow();
    }
  });

  it('rejects missing files, malformed TypeScript and invalid limits before use', async () => {
    await expect(loadConversationConfig('/missing/conversations.ts')).rejects.toThrow();
    for (const contents of [
      '{', 'null', '[]', '{"listPageSize": 0}', '{"maxListPageSize": -1}',
      '{"listPageSize": 1.5}', '{"maxListPageSize": "100"}',
      '{"listPageSize": 101}', '{"language": 7}', '{"language": null}',
    ]) {
      await expect(loadConversationConfig(await configFile(contents))).rejects.toThrow();
    }
  });
});
