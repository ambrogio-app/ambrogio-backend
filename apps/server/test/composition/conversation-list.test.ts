import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareConversationList } from '../../src/composition/conversation-list.js';

const directories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-server-list-'));
  directories.push(directory);
  return { configFilename: join(directory, 'conversations.json'), archiveFilename: join(directory, 'archive.sqlite') };
}

function environment(configFilename: string): NodeJS.ProcessEnv {
  return { AMBROGIO_CONVERSATIONS_CONFIG_PATH: configFilename };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('server conversation-list composition', () => {
  it('loads JSON before opening the archive and uses the configured page size', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"listPageSize": 1, "maxListPageSize": 2}');
    const prepared = await prepareConversationList(files.archiveFilename, new Date(1000), {
      ...environment(files.configFilename),
      AMBROGIO_CONVERSATIONS_LIST_PAGE_SIZE: '50',
    });
    try {
      await prepared.archive.db.insertInto('conversations').values([
        { id: 'a', created_at: 100, last_activity_at: 100 },
        { id: 'b', created_at: 200, last_activity_at: 200 },
      ]).execute();
      const page = await prepared.listConversations({});
      expect(page.items.map(item => item.id)).toEqual(['b']);
      expect(page.next?.id).toBe('b');
    } finally {
      await prepared.archive.close();
    }
  });

  it('rejects invalid JSON before creating the SQLite archive', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"listPageSize": 0}');
    await expect(prepareConversationList(files.archiveFilename, new Date(1000), environment(files.configFilename)))
      .rejects.toThrow('Invalid conversation list limits');
    await expect(readFile(files.archiveFilename)).rejects.toThrow();
  });

  it('requires the configured environment path before opening the archive', async () => {
    const files = await fixture();
    for (const absent of [{}, { AMBROGIO_CONVERSATIONS_CONFIG_PATH: '  ' }]) {
      await expect(prepareConversationList(files.archiveFilename, new Date(1000), absent))
        .rejects.toThrow('Missing conversation configuration path');
    }
    await expect(prepareConversationList(files.archiveFilename, new Date(1000),
      environment(join(files.archiveFilename, 'missing.json')))).rejects.toThrow('Invalid conversation configuration file');
    await expect(readFile(files.archiveFilename)).rejects.toThrow();
  });

  it('uses the process environment when no environment is injected', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const previous = process.env.AMBROGIO_CONVERSATIONS_CONFIG_PATH;
    process.env.AMBROGIO_CONVERSATIONS_CONFIG_PATH = files.configFilename;
    try {
      const prepared = await prepareConversationList(files.archiveFilename, new Date(1000));
      try {
        expect((await prepared.listConversations({})).items).toEqual([]);
      } finally {
        await prepared.archive.close();
      }
    } finally {
      if (previous === undefined) delete process.env.AMBROGIO_CONVERSATIONS_CONFIG_PATH;
      else process.env.AMBROGIO_CONVERSATIONS_CONFIG_PATH = previous;
    }
  });

  it('recovers a pending turn before returning the prepared list', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const first = await prepareConversationList(files.archiveFilename, new Date(1000), environment(files.configFilename));
    await first.archive.db.insertInto('conversations').values({
      id: 'conversation', created_at: 100, last_activity_at: 100,
    }).execute();
    await first.archive.db.insertInto('turns').values({
      id: 'turn', conversation_id: 'conversation', ordinal: 1, text: 'hello', accepted_at: 100,
      status: 'pending', answer: null, error: null, finished_at: null,
    }).execute();
    await first.archive.db.updateTable('installation').set({ active_turn_id: 'turn' }).where('id', '=', 1).execute();
    await first.archive.close();

    const second = await prepareConversationList(files.archiveFilename, new Date(2000), environment(files.configFilename));
    try {
      expect(second.archive.recoveredTurns).toBe(1);
      expect(await second.archive.db.selectFrom('turns').select(['status', 'finished_at']).executeTakeFirst())
        .toEqual({ status: 'interrupted', finished_at: 2000 });
      expect((await second.listConversations({})).items.map(item => item.id)).toEqual(['conversation']);
    } finally {
      await second.archive.close();
    }
  });
});
