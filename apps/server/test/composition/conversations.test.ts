import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { assembleExchangeTurn, prepareConversations, registerConversationHistoryRoute, registerConversationListRoute, registerConversationTurnRoute } from '../../src/composition/conversations.js';

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

describe('server conversation composition', () => {
  it('loads JSON before opening the archive and uses the configured page size', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"listPageSize": 1, "maxListPageSize": 2, "language":"it"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), {
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
      expect(prepared.failureMessage).toBe('Non riesco a completare la risposta.');
    } finally {
      await prepared.archive.close();
    }
  });

  it('serves configured list pages and a current first page after activity changes', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"listPageSize":2,"maxListPageSize":3}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const server = Fastify();
    try {
      await prepared.archive.db.insertInto('conversations').values([
        { id: 'a', created_at: 100, last_activity_at: 300 },
        { id: 'b', created_at: 100, last_activity_at: 200 },
        { id: 'c', created_at: 100, last_activity_at: 200 },
        { id: 'd', created_at: 100, last_activity_at: 100 },
      ]).execute();
      registerConversationListRoute(server, prepared);
      const first = (await server.inject({ method: 'GET', url: '/api/conversations' })).json();
      expect(first.items.map((item: { id: string }) => item.id)).toEqual(['a', 'c']);
      expect(typeof first.nextCursor).toBe('string');
      const second = (await server.inject({ method: 'GET',
        url: `/api/conversations?cursor=${first.nextCursor}` })).json();
      expect(second.items.map((item: { id: string }) => item.id)).toEqual(['b', 'd']);
      expect(second.nextCursor).toBeNull();

      await prepared.archive.db.updateTable('conversations').set({ last_activity_at: 400 })
        .where('id', '=', 'd').execute();
      const refreshed = (await server.inject({ method: 'GET', url: '/api/conversations' })).json();
      expect(refreshed.items.map((item: { id: string }) => item.id)).toEqual(['d', 'a']);
    } finally {
      await server.close();
      await prepared.archive.close();
    }
  });

  it('rejects invalid JSON before creating the SQLite archive', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"listPageSize": 0}');
    await expect(prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename)))
      .rejects.toThrow('Invalid conversation list limits');
    await expect(readFile(files.archiveFilename)).rejects.toThrow();
  });

  it('requires the configured environment path before opening the archive', async () => {
    const files = await fixture();
    for (const absent of [{}, { AMBROGIO_CONVERSATIONS_CONFIG_PATH: '  ' }]) {
      await expect(prepareConversations(files.archiveFilename, new Date(1000), absent))
        .rejects.toThrow('Missing conversation configuration path');
    }
    await expect(prepareConversations(files.archiveFilename, new Date(1000),
      environment(join(files.archiveFilename, 'missing.json')))).rejects.toThrow('Invalid conversation configuration file');
    await expect(readFile(files.archiveFilename)).rejects.toThrow();
  });

  it('uses the process environment when no environment is injected', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const previous = process.env.AMBROGIO_CONVERSATIONS_CONFIG_PATH;
    process.env.AMBROGIO_CONVERSATIONS_CONFIG_PATH = files.configFilename;
    try {
      const prepared = await prepareConversations(files.archiveFilename, new Date(1000));
      try {
        expect((await prepared.listConversations({})).items).toEqual([]);
        expect(prepared.failureMessage).toBe("I can't complete the response.");
      } finally {
        await prepared.archive.close();
      }
    } finally {
      if (previous === undefined) delete process.env.AMBROGIO_CONVERSATIONS_CONFIG_PATH;
      else process.env.AMBROGIO_CONVERSATIONS_CONFIG_PATH = previous;
    }
  });

  it('uses English for an unsupported configured language', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"language":"fr"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    try {
      expect(prepared.failureMessage).toBe("I can't complete the response.");
    } finally {
      await prepared.archive.close();
    }
  });

  it('passes the selected Italian failure message through the use case into SQLite', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"language":"it"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    try {
      const exchange = assembleExchangeTurn(prepared, {
        async *produce() { throw new Error('private provider failure'); },
      });
      const result = await exchange({ text: 'domanda' });
      expect(result).toMatchObject({ ok: true, value: {
        outcome: 'failed', error: 'Non riesco a completare la risposta.',
      } });
      const row = await prepared.archive.db.selectFrom('turns').select(['status', 'error']).executeTakeFirst();
      expect(row).toEqual({ status: 'failed', error: 'Non riesco a completare la risposta.' });
    } finally {
      await prepared.archive.close();
    }
  });

  it('serves a text turn through Fastify and conserves its completed answer', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"language":"it"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const server = Fastify();
    try {
      registerConversationTurnRoute(server, prepared, {
        async *produce(history) {
          expect(history.turns.at(-1)?.text).toBe('ciao');
          yield 'Buon';
          yield 'giorno';
        },
      });
      const response = await server.inject({
        method: 'POST', url: '/api/conversations/turns',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ text: 'ciao' }),
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toMatch(/^data: \{"type":"start","messageId":"[^"]+","messageMetadata":\{"conversationId":"[^"]+","turnId":"[^"]+"\}\}\n\n/);
      expect(response.body).toContain('"delta":"Buon"');
      expect(response.body).toContain('"delta":"giorno"');
      expect(response.body).toContain('"type":"finish","finishReason":"stop"');
      const stored = await prepared.archive.db.selectFrom('turns')
        .select(['text', 'status', 'answer']).executeTakeFirst();
      expect(stored).toEqual({ text: 'ciao', status: 'answered', answer: 'Buongiorno' });
    } finally {
      await server.close();
      await prepared.archive.close();
    }
  });

  it('reads a pending turn and then its persisted answer through GET without another stream', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"language":"it"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const server = Fastify();
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => { signalStarted = resolve; });
    let release!: () => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    try {
      registerConversationTurnRoute(server, prepared, {
        async *produce() {
          signalStarted();
          await released;
          yield 'risposta completa';
        },
      });
      registerConversationHistoryRoute(server, prepared);
      const post = server.inject({ method: 'POST', url: '/api/conversations/turns',
        headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ text: '  domanda  interna  ' }) });
      await started;
      const conversation = await prepared.archive.db.selectFrom('conversations').select('id').executeTakeFirstOrThrow();
      const url = `/api/conversations/${conversation.id}`;
      const pending = await server.inject({ method: 'GET', url });
      expect(pending.statusCode).toBe(200);
      expect(pending.headers['content-type']).toMatch(/^application\/json/);
      expect(pending.headers['cache-control']).toBe('no-store');
      expect(pending.json()).toMatchObject({ id: conversation.id,
        turns: [{ text: '  domanda  interna  ', status: 'pending' }] });
      expect(pending.json().turns[0]).not.toHaveProperty('answer');
      expect(pending.json().turns[0]).not.toHaveProperty('finishedAt');

      release();
      expect((await post).body).toContain('"type":"finish"');
      const completed = await server.inject({ method: 'GET', url });
      expect(completed.json()).toMatchObject({ id: conversation.id,
        turns: [{ text: '  domanda  interna  ', status: 'answered', answer: 'risposta completa' }] });
      expect(completed.json().turns).toHaveLength(1);
      expect(completed.json().turns[0].finishedAt).toMatch(/Z$/);
      const missing = await server.inject({ method: 'GET', url: '/api/conversations/missing' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: 'Conversazione non trovata.' });
    } finally {
      release();
      await server.close();
      await prepared.archive.close();
    }
  });

  it('rejects empty text before admission for new, existing, and missing conversations', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const server = Fastify();
    try {
      registerConversationTurnRoute(server, prepared, { async *produce() { yield 'answer'; } });
      const submit = (text: string, conversationId?: string) => server.inject({
        method: 'POST', url: '/api/conversations/turns',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ text, ...(conversationId ? { conversationId } : {}) }),
      });
      const accepted = await submit('valid');
      expect(accepted.statusCode).toBe(200);
      const conversation = await prepared.archive.db.selectFrom('conversations').select('id').executeTakeFirstOrThrow();
      const beforeConversations = await prepared.archive.db.selectFrom('conversations').select('id').execute();
      const beforeTurns = await prepared.archive.db.selectFrom('turns').select('id').execute();
      for (const conversationId of [undefined, conversation.id, 'missing']) {
        for (const text of ['', '  \t  ']) {
          const response = await submit(text, conversationId);
          expect(response.statusCode).toBe(400);
          expect(response.headers['content-type']).toMatch(/^application\/json/);
          expect(response.headers['cache-control']).toBe('no-store');
          expect(response.json()).toEqual({ error: 'Invalid message.' });
          expect(response.body).not.toContain('data: ');
          expect(await prepared.archive.db.selectFrom('conversations').select('id').execute())
            .toEqual(beforeConversations);
          expect(await prepared.archive.db.selectFrom('turns').select('id').execute())
            .toEqual(beforeTurns);
        }
      }
    } finally {
      await server.close();
      await prepared.archive.close();
    }
  });

  it('rejects a simultaneous turn in the same conversation without queuing it', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const server = Fastify();
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => { signalStarted = resolve; });
    let releaseFirst!: () => void;
    const released = new Promise<void>(resolve => { releaseFirst = resolve; });
    try {
      registerConversationTurnRoute(server, prepared, {
        async *produce() {
          signalStarted();
          await released;
          yield 'answer';
        },
      });
      const request = (text: string, conversationId?: string) => ({ method: 'POST' as const,
        url: '/api/conversations/turns', headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ text, ...(conversationId ? { conversationId } : {}) }) });
      const first = server.inject(request('first'));
      await started;
      const conversation = await prepared.archive.db.selectFrom('conversations').select('id').executeTakeFirstOrThrow();
      const second = await server.inject(request('second', conversation.id));
      expect(second.statusCode).toBe(409);
      expect(second.json()).toEqual({ error: 'Another turn is in progress.' });
      expect(await prepared.archive.db.selectFrom('turns').select('text').execute())
        .toEqual([{ text: 'first' }]);
      releaseFirst();
      expect((await first).body).toContain('"type":"finish"');
    } finally {
      releaseFirst();
      await server.close();
      await prepared.archive.close();
    }
  });

  it('blocks new HTTP turns after a completion write failure and recovers on restart', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"language":"it"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const server = Fastify();
    let archiveClosed = false;
    try {
      registerConversationTurnRoute(server, prepared, {
        async *produce() {
          await prepared.archive.close();
          archiveClosed = true;
          yield 'parziale';
        },
      });
      const request = (text: string) => ({ method: 'POST' as const,
        url: '/api/conversations/turns', headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ text }) });
      const first = await server.inject(request('prima domanda'));
      expect(first.statusCode).toBe(200);
      expect(first.body).toContain('"type":"error","errorText":"Non riesco a completare la risposta."');
      expect(first.body).not.toContain('"type":"finish"');
      const blocked = await server.inject(request('seconda domanda'));
      expect(blocked.statusCode).toBe(503);
      expect(blocked.json()).toEqual({ error: 'Servizio temporaneamente non disponibile.' });
    } finally {
      await server.close();
      if (!archiveClosed) await prepared.archive.close();
    }

    const restarted = await prepareConversations(files.archiveFilename, new Date(2000), environment(files.configFilename));
    const restartedServer = Fastify();
    try {
      expect(restarted.archive.recoveredTurns).toBe(1);
      expect(await restarted.archive.db.selectFrom('turns').select('status').executeTakeFirst())
        .toEqual({ status: 'interrupted' });
      registerConversationTurnRoute(restartedServer, restarted, { async *produce() { yield 'pronta'; } });
      const response = await restartedServer.inject({ method: 'POST', url: '/api/conversations/turns',
        headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ text: 'nuova domanda' }) });
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('"type":"finish"');
    } finally {
      await restartedServer.close();
      await restarted.archive.close();
    }
  });

  it('recovers a pending turn before returning the prepared list', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const first = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    await first.archive.db.insertInto('conversations').values({
      id: 'conversation', created_at: 100, last_activity_at: 100,
    }).execute();
    await first.archive.db.insertInto('turns').values({
      id: 'turn', conversation_id: 'conversation', ordinal: 1, text: 'hello', accepted_at: 100,
      status: 'pending', answer: null, error: null, finished_at: null,
    }).execute();
    await first.archive.db.updateTable('conversations').set({ active_turn_id: 'turn' }).where('id', '=', 'conversation').execute();
    await first.archive.close();

    const second = await prepareConversations(files.archiveFilename, new Date(2000), environment(files.configFilename));
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
