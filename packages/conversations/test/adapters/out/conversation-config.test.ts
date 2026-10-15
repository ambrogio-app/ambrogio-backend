import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConversationConfig } from '../../../src/adapters/out/conversation-config.js';

const directories: string[] = [];

async function configFile(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-conversation-config-'));
  directories.push(directory);
  const filename = join(directory, 'conversations.json');
  await writeFile(filename, contents);
  return filename;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('conversation JSON configuration', () => {
  it('uses defaults for absent fields and accepts explicit page limits', async () => {
    expect(await loadConversationConfig(await configFile('{}'))).toEqual({
      listPageSize: 20, maxListPageSize: 100, language: 'en',
    });
    expect(await loadConversationConfig(await configFile('{"listPageSize": 2, "maxListPageSize": 3}'))).toEqual({
      listPageSize: 2, maxListPageSize: 3, language: 'en',
    });
    expect(await loadConversationConfig(await configFile('{"listPageSize": 110, "maxListPageSize": 120}'))).toEqual({
      listPageSize: 110, maxListPageSize: 120, language: 'en',
    });
  });

  it('selects English or Italian and falls back to English for an unsupported language', async () => {
    expect((await loadConversationConfig(await configFile('{"language":"en"}'))).language).toBe('en');
    expect((await loadConversationConfig(await configFile('{"language":"it"}'))).language).toBe('it');
    expect((await loadConversationConfig(await configFile('{"language":"fr"}'))).language).toBe('en');
  });

  it('rejects missing files, malformed JSON and invalid limits before use', async () => {
    await expect(loadConversationConfig('/missing/conversations.json')).rejects.toThrow();
    for (const contents of [
      '{', 'null', '[]', '{"listPageSize": 0}', '{"maxListPageSize": -1}',
      '{"listPageSize": 1.5}', '{"maxListPageSize": "100"}',
      '{"listPageSize": 101}', '{"language": 7}', '{"language": null}',
    ]) {
      await expect(loadConversationConfig(await configFile(contents))).rejects.toThrow();
    }
  });
});
