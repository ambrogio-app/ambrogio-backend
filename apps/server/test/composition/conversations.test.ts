import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import type { ProduceConversationReply, ReplyPart } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { SpeechComponents } from '@ambrogio/conversations/adapters/in/session/speech-components';
import { assembleExchangeTurn, loadProtocolSchema, prepareConversations, registerConversationHistoryRoute,
  registerConversationListRoute, registerConversationSessionRoute } from '../../src/composition/conversations.js';
import { closeAllClients, pcm, ProtocolClient, takeSchemaViolations } from '../runtime/protocol-client.js';

const directories: string[] = [];

const text = (value: string): ReplyPart => ({ kind: 'text', text: value });
const expectation = (expectsReply: boolean): ReplyPart => ({ kind: 'reply_expectation', expectsReply });

/** Speech whose transcript is exactly the UTF-8 content of the received audio, without trimming. */
const verbatimSpeech: SpeechComponents = {
  transcriber: {
    async transcribe(audio) {
      const parts: Buffer[] = [];
      for await (const chunk of audio) parts.push(Buffer.from(chunk));
      return Buffer.concat(parts).toString('utf8');
    },
  },
  synthesizer: {
    sampleRate: 22_050,
    async *synthesize(input) { for await (const piece of input) yield Buffer.from(piece, 'utf8'); },
  },
  async close() {},
};

/** Fastify with the conversation session channel and the history route on an ephemeral port. */
async function sessionServer(prepared: Awaited<ReturnType<typeof prepareConversations>>,
  reply: ProduceConversationReply, speech?: SpeechComponents) {
  const server = Fastify();
  await server.register(websocket);
  const sessions = registerConversationSessionRoute(server, prepared, reply, {
    schema: await loadProtocolSchema(), allowedOrigins: [], pingIntervalMs: 30_000,
    ...(speech ? { speech } : {}),
  });
  registerConversationHistoryRoute(server, prepared);
  await server.listen({ host: '127.0.0.1', port: 0 });
  const { port } = server.server.address() as AddressInfo;
  let closed = false;
  return { server, url: `ws://127.0.0.1:${port}/api/session`, async close() {
    if (closed) return;
    closed = true;
    await sessions.stopAccepting();
    await sessions.closeSessions();
    await server.close();
  } };
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-server-list-'));
  directories.push(directory);
  return { configFilename: join(directory, 'conversations.json'), archiveFilename: join(directory, 'archive.sqlite') };
}

function environment(configFilename: string): NodeJS.ProcessEnv {
  return { AMBROGIO_CONVERSATIONS_CONFIG_PATH: configFilename };
}

afterEach(async () => {
  await closeAllClients();
  expect(takeSchemaViolations()).toEqual([]);
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
        async *produce(): AsyncGenerator<ReplyPart> { throw new Error('private provider failure'); },
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

  it('serves a text turn through the session channel and conserves its completed answer', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"language":"it"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const running = await sessionServer(prepared, {
      async *produce(history) {
        expect(history.turns.at(-1)?.text).toBe('ciao');
        yield text('Buon');
        yield text('giorno');
        yield expectation(false);
      },
    });
    try {
      const client = await ProtocolClient.ready(running.url);
      const result = await client.textTurn('ciao');
      expect(result.sequence).toEqual(['turn.accepted', 'output.start', 'output.chunk', 'output.chunk',
        'output.end', 'turn.completed']);
      expect(result.outputs[0]!.text).toBe('Buongiorno');
      expect(result.final).toEqual({ type: 'turn.completed', turnId: result.accepted!.turnId, expectsReply: false });
      const stored = await prepared.archive.db.selectFrom('turns')
        .select(['text', 'status', 'answer']).executeTakeFirst();
      expect(stored).toEqual({ text: 'ciao', status: 'answered', answer: 'Buongiorno' });
    } finally {
      await running.close();
      await prepared.archive.close();
    }
  });

  it('reads a pending turn and then its persisted answer through GET without another stream', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"language":"it"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => { signalStarted = resolve; });
    let release!: () => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    const running = await sessionServer(prepared, {
      async *produce() {
        signalStarted();
        await released;
        yield text('risposta completa');
        yield expectation(false);
      },
    });
    try {
      const client = await ProtocolClient.ready(running.url);
      const requestId = client.requestId();
      client.startText(requestId);
      client.chunk(requestId, '  domanda  interna  ');
      client.end(requestId);
      await started;
      const conversation = await prepared.archive.db.selectFrom('conversations').select('id').executeTakeFirstOrThrow();
      const url = `/api/conversations/${conversation.id}`;
      const pending = await running.server.inject({ method: 'GET', url });
      expect(pending.statusCode).toBe(200);
      expect(pending.headers['content-type']).toMatch(/^application\/json/);
      expect(pending.headers['cache-control']).toBe('no-store');
      expect(pending.json()).toMatchObject({ id: conversation.id,
        turns: [{ text: '  domanda  interna  ', status: 'pending' }] });
      expect(pending.json().turns[0]).not.toHaveProperty('answer');
      expect(pending.json().turns[0]).not.toHaveProperty('finishedAt');

      release();
      expect((await client.result(requestId)).final.type).toBe('turn.completed');
      const completed = await running.server.inject({ method: 'GET', url });
      expect(completed.json()).toMatchObject({ id: conversation.id,
        turns: [{ text: '  domanda  interna  ', status: 'answered', answer: 'risposta completa' }] });
      expect(completed.json().turns).toHaveLength(1);
      expect(completed.json().turns[0].finishedAt).toMatch(/Z$/);
      const missing = await running.server.inject({ method: 'GET', url: '/api/conversations/missing' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: 'Conversazione non trovata.' });
    } finally {
      release();
      await running.close();
      await prepared.archive.close();
    }
  });

  // Verification: Prova della conservazione del testo originale
  it('conserves typed and transcribed turn text exactly as received', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const histories: string[] = [];
    const running = await sessionServer(prepared, {
      async *produce(history) {
        histories.push(history.turns.at(-1)!.text);
        yield text('ok');
        yield expectation(false);
      },
    }, verbatimSpeech);
    try {
      const client = await ProtocolClient.ready(running.url);
      const original = '  accendi   la luce\t ';
      const typed = await client.textTurn(original);
      const spoken = await client.audioTurn(pcm(original, Buffer.byteLength(original)));
      for (const result of [typed, spoken]) {
        expect(result.accepted!.text).toBe(original);
        const history = await running.server.inject({ method: 'GET',
          url: `/api/conversations/${result.accepted!.conversationId as string}` });
        expect(history.json().turns).toMatchObject([{ text: original, status: 'answered' }]);
      }
      expect(histories).toEqual([original, original]);
      for (const blank of ['', '  \t  ']) {
        expect((await client.textTurn(blank)).final).toMatchObject({ type: 'turn.rejected', reason: 'invalid' });
      }
      expect((await client.audioTurn(pcm('   ', 4))).final)
        .toMatchObject({ type: 'turn.rejected', reason: 'transcription_failed' });
      expect(await prepared.archive.db.selectFrom('turns').select('text').execute())
        .toEqual([{ text: original }, { text: original }]);
    } finally {
      await running.close();
      await prepared.archive.close();
    }
  });

  it('rejects empty text before admission for new, existing, and missing conversations', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    const running = await sessionServer(prepared, {
      async *produce() { yield text('answer'); yield expectation(false); },
    });
    try {
      const client = await ProtocolClient.ready(running.url);
      const accepted = await client.textTurn('valid');
      expect(accepted.final.type).toBe('turn.completed');
      const conversation = await prepared.archive.db.selectFrom('conversations').select('id').executeTakeFirstOrThrow();
      const beforeConversations = await prepared.archive.db.selectFrom('conversations').select('id').execute();
      const beforeTurns = await prepared.archive.db.selectFrom('turns').select('id').execute();
      for (const conversationId of [undefined, conversation.id, 'missing']) {
        for (const value of ['', '  \t  ']) {
          const result = await client.textTurn(value, conversationId ? { conversationId } : {});
          expect(result.accepted).toBeUndefined();
          expect(result.outputs.map(output => output.text)).toEqual(['Invalid message.']);
          expect(result.final).toEqual({ type: 'turn.rejected', requestId: result.final.requestId,
            reason: 'invalid', message: 'Invalid message.' });
          expect(await prepared.archive.db.selectFrom('conversations').select('id').execute())
            .toEqual(beforeConversations);
          expect(await prepared.archive.db.selectFrom('turns').select('id').execute())
            .toEqual(beforeTurns);
        }
      }
    } finally {
      await running.close();
      await prepared.archive.close();
    }
  });

  it('rejects a simultaneous turn in the same conversation without queuing it', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => { signalStarted = resolve; });
    let releaseFirst!: () => void;
    const released = new Promise<void>(resolve => { releaseFirst = resolve; });
    const running = await sessionServer(prepared, {
      async *produce() {
        signalStarted();
        await released;
        yield text('answer');
        yield expectation(false);
      },
    });
    try {
      const client = await ProtocolClient.ready(running.url);
      const first = client.requestId();
      client.startText(first);
      client.chunk(first, 'first');
      client.end(first);
      await started;
      const conversation = await prepared.archive.db.selectFrom('conversations').select('id').executeTakeFirstOrThrow();
      const second = await client.textTurn('second', { conversationId: conversation.id });
      expect(second.final).toMatchObject({ type: 'turn.rejected', reason: 'occupied',
        message: 'Another turn is in progress.' });
      expect(await prepared.archive.db.selectFrom('turns').select('text').execute())
        .toEqual([{ text: 'first' }]);
      releaseFirst();
      expect((await client.result(first)).final.type).toBe('turn.completed');
      expect(await prepared.archive.db.selectFrom('turns').select('text').execute())
        .toEqual([{ text: 'first' }]);
    } finally {
      releaseFirst();
      await running.close();
      await prepared.archive.close();
    }
  });

  it('blocks new turns after a completion write failure and recovers on restart', async () => {
    const files = await fixture();
    await writeFile(files.configFilename, '{"language":"it"}');
    const prepared = await prepareConversations(files.archiveFilename, new Date(1000), environment(files.configFilename));
    let archiveClosed = false;
    const running = await sessionServer(prepared, {
      async *produce() {
        await prepared.archive.close();
        archiveClosed = true;
        yield text('parziale');
        yield expectation(false);
      },
    });
    try {
      const client = await ProtocolClient.ready(running.url);
      const first = await client.textTurn('prima domanda');
      expect(first.final).toEqual({ type: 'turn.failed', turnId: first.accepted!.turnId,
        message: 'Non riesco a completare la risposta.' });
      expect(first.outputs.map(output => output.text)).toEqual(['parziale', 'Non riesco a completare la risposta.']);
      expect(first.sequence).not.toContain('turn.completed');
      const blocked = await client.textTurn('seconda domanda');
      expect(blocked.final).toMatchObject({ type: 'turn.rejected', reason: 'unavailable',
        message: 'Servizio temporaneamente non disponibile.' });
    } finally {
      await running.close();
      if (!archiveClosed) await prepared.archive.close();
    }

    const restarted = await prepareConversations(files.archiveFilename, new Date(2000), environment(files.configFilename));
    const restartedServer = await sessionServer(restarted, {
      async *produce() { yield text('pronta'); yield expectation(false); },
    });
    try {
      expect(restarted.archive.recoveredTurns).toBe(1);
      expect(await restarted.archive.db.selectFrom('turns').select('status').executeTakeFirst())
        .toEqual({ status: 'interrupted' });
      const client = await ProtocolClient.ready(restartedServer.url);
      expect((await client.textTurn('nuova domanda')).final.type).toBe('turn.completed');
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
