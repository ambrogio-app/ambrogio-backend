import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConversationListConfig } from '../../../src/adapters/out/conversation-list-config.js';

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

describe('conversation list JSON configuration', () => {
  it('uses defaults for absent fields and accepts explicit page limits', async () => {
    expect(await loadConversationListConfig(await configFile('{}'))).toEqual({
      listPageSize: 20, maxListPageSize: 100,
    });
    expect(await loadConversationListConfig(await configFile('{"listPageSize": 2, "maxListPageSize": 3}'))).toEqual({
      listPageSize: 2, maxListPageSize: 3,
    });
    expect(await loadConversationListConfig(await configFile('{"listPageSize": 110, "maxListPageSize": 120}'))).toEqual({
      listPageSize: 110, maxListPageSize: 120,
    });
  });

  it('rejects missing files, malformed JSON and invalid limits before use', async () => {
    await expect(loadConversationListConfig('/missing/conversations.json')).rejects.toThrow();
    for (const contents of [
      '{', 'null', '[]', '{"listPageSize": 0}', '{"maxListPageSize": -1}',
      '{"listPageSize": 1.5}', '{"maxListPageSize": "100"}',
      '{"listPageSize": 101}',
    ]) {
      await expect(loadConversationListConfig(await configFile(contents))).rejects.toThrow();
    }
  });
});
