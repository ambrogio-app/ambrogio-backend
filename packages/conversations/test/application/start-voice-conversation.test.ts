import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openConversationArchive } from '../../src/adapters/out/sqlite/conversation-archive.js';
import { SqliteConversationWrite } from '../../src/adapters/out/sqlite/sqlite-conversation-write.js';
import { SqliteConversationHistoryRead } from '../../src/adapters/out/sqlite/sqlite-conversation-history-read.js';
import { createStartVoiceConversation } from '../../src/application/start-voice-conversation.use-case.js';
import { createBeginTurn } from '../../src/application/begin-turn.use-case.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path =>
  rm(path, { recursive: true, force: true }))); });

it('creates an empty voice conversation at connection and shares installation admission with text', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-voice-start-'));
  directories.push(directory);
  const archive = await openConversationArchive(join(directory, 'archive.sqlite'), new Date(0));
  try {
    const write = new SqliteConversationWrite(archive.db);
    let next = 0;
    const identifiers = { next: () => `id-${++next}` };
    const clock = { now: () => new Date(1000) };
    const start = createStartVoiceConversation({ archive: write, identifiers, clock });
    expect(await start()).toEqual({ ok: true, value: { conversationId: 'id-1' } });
    const history = new SqliteConversationHistoryRead(archive.db);
    expect((await history.find('id-1'))?.turns).toEqual([]);
    const begin = createBeginTurn({ archive: write, identifiers, clock });
    expect((await begin({ text: 'testo', conversationId: 'id-1' })).ok).toBe(true);
    expect(await start()).toEqual({ ok: false, error: { kind: 'occupied' } });
    expect(await begin({ text: 'altro' })).toEqual({ ok: false, error: { kind: 'occupied' } });
    expect((await history.find('id-1'))?.turns).toHaveLength(1);
  } finally { await archive.close(); }
});
