import Fastify from 'fastify';
import { request as httpRequest } from 'node:http';
import { Readable, Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from 'ai';
import { createExchangeTurn } from '../../../src/application/exchange-turn.use-case.js';
import { createBeginTurn } from '../../../src/application/begin-turn.use-case.js';
import { Turn } from '../../../src/domain/turn.js';
import { ProjectError } from '../../../src/project-error.js';
import type { ExchangeTurn } from '../../../src/application/exchange-turn.use-case.js';
import { registerTurnRoute, TURN_BODY_LIMIT } from '../../../src/adapters/in/http/turn-route.js';

const servers: ReturnType<typeof Fastify>[] = [];
const post = (body: string) => ({
  method: 'POST' as const,
  url: '/api/conversations/turns',
  headers: { 'content-type': 'application/json' },
  payload: body,
});
const jsonPost = (body: unknown) => post(JSON.stringify(body));

function fixture(exchange: ExchangeTurn, language: 'en' | 'it' = 'en') {
  const server = Fastify();
  servers.push(server);
  registerTurnRoute(server, { exchange, language });
  return server;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(server => server.close()));
});

function loggedFixture(exchange: ExchangeTurn) {
  const lines: string[] = [];
  const server = Fastify({ logger: { level: 'error',
    stream: new Writable({ write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    } }),
    serializers: { err: () => ({ type: 'Error', message: 'Unexpected HTTP failure',
      stack: '[redacted]' }) },
  } });
  servers.push(server);
  registerTurnRoute(server, { exchange, language: 'en' });
  return { server, lines };
}

function expectExplicitDiagnosticFields(line: string, event: string) {
  const row = JSON.parse(line) as Record<string, unknown>;
  expect(Object.keys(row).sort()).toEqual([
    'err', 'event', 'hostname', 'level', 'msg', 'pid', 'reqId', 'time',
  ]);
  expect(row.event).toBe(event);
  expect(Object.keys(row.err as Record<string, unknown>).sort()).toEqual([
    'message', 'stack', 'type',
  ]);
}

function uiParts(body: string): Array<Record<string, unknown>> {
  const lines = body.split('\n').filter(line => line.startsWith('data: '));
  expect(lines.at(-1)).toBe('data: [DONE]');
  return lines.slice(0, -1).map(line => JSON.parse(line.slice(6)) as Record<string, unknown>);
}

describe('text turn HTTP ingress', () => {
  it('rejects empty text before a missing conversation, malformed JSON and unsupported fields', async () => {
    const admit = vi.fn(async () => { throw new Error('archive admission must not run'); });
    const completeArchive = vi.fn(async () => { throw new Error('archive completion must not run'); });
    const exchange = vi.fn(createExchangeTurn({
      begin: createBeginTurn({ archive: { admit, complete: completeArchive },
        identifiers: { next: () => 'turn-id' }, clock: { now: () => new Date(1000) } }),
      complete: async () => { throw new Error('completion must not run'); },
      history: { async find() { throw new Error('history must not run'); } },
      reply: { async *produce() { throw new Error('reply must not run'); } },
      failureMessage: "I can't complete the response.",
    }));
    const server = fixture(exchange);
    for (const request of [
      jsonPost({ text: '   ', conversationId: 'missing' }),
      post('{broken'),
      jsonPost({ text: 42 }),
      jsonPost({ text: 'hello', history: [] }),
      jsonPost({ text: 'hello', conversationId: 5 }),
      { ...post('hello'), headers: { 'content-type': 'text/plain' } },
    ]) {
      const response = await server.inject(request);
      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ error: 'Invalid message.' });
    }
    expect(exchange).not.toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
    expect(completeArchive).not.toHaveBeenCalled();
  });

  it('maps expected admission rejections to distinct HTTP errors in Italian', async () => {
    const statuses = [
      ['conversation_not_found', 404, 'Conversazione non trovata.'],
      ['occupied', 409, 'Un altro turno è in corso.'],
      ['temporarily_unavailable', 503, 'Servizio temporaneamente non disponibile.'],
    ] as const;
    for (const [kind, status, message] of statuses) {
      const server = fixture(async () => ({ ok: false, error: { kind } }), 'it');
      const response = await server.inject(jsonPost({ text: 'ciao', conversationId: 'missing' }));
      expect(response.statusCode).toBe(status);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ error: message });
    }
  });

  it('does not emit warn or error logs for expected admission and protocol outcomes', async () => {
    const begin = createBeginTurn({
      archive: {
        async admit({ turn }) {
          return { ok: false as const, error: { kind: turn.snapshot().text === 'busy'
            ? 'archive_busy' as const : 'conversation_occupied' as const } };
        },
        async complete() { throw new Error('unexpected completion'); },
      },
      identifiers: { next: () => 'turn-id' },
      clock: { now: () => new Date(1000) },
    });
    const exchange = createExchangeTurn({
      begin,
      complete: async () => { throw new Error('unexpected completion'); },
      history: { async find() { throw new Error('unexpected history read'); } },
      reply: { async *produce() { throw new Error('unexpected reply'); } },
      failureMessage: "I can't complete the response.",
    });
    const { server, lines } = loggedFixture(exchange);
    const rootErrors = vi.spyOn(server.log, 'error');
    const rootWarnings = vi.spyOn(server.log, 'warn');
    const calls: { errors: unknown[][]; warnings: unknown[][] }[] = [];
    server.addHook('onRequest', (request, _reply, done) => {
      calls.push({ errors: vi.spyOn(request.log, 'error').mock.calls,
        warnings: vi.spyOn(request.log, 'warn').mock.calls });
      done();
    });
    const domainTurn = Turn.accept({ id: 'domain-turn', text: 'domain text',
      acceptedAt: new Date(1000) });
    expect(domainTurn.answer('answer', new Date(2000))).toEqual({ ok: true, value: undefined });
    expect(domainTurn.answer('another answer', new Date(3000)))
      .toEqual({ ok: false, error: { kind: 'already_closed' } });
    expect(rootErrors).not.toHaveBeenCalled();
    expect(rootWarnings).not.toHaveBeenCalled();
    expect(lines).toEqual([]);
    for (const [request, status] of [
      [jsonPost({ text: 'occupied', conversationId: 'existing' }), 409],
      [jsonPost({ text: 'busy', conversationId: 'existing' }), 503],
      [post('{broken'), 400],
    ] as const) {
      const response = await server.inject(request);
      expect(response.statusCode).toBe(status);
      expect(calls.at(-1)?.errors).toEqual([]);
      expect(calls.at(-1)?.warnings).toEqual([]);
      expect(lines).toEqual([]);
    }
    expect(calls).toHaveLength(3);
    expect(rootErrors).not.toHaveBeenCalled();
    expect(rootWarnings).not.toHaveBeenCalled();
  });

  it('caps the actual JSON body at 64 KiB before admission', async () => {
    let calls = 0;
    const server = fixture(async () => { calls += 1; throw new Error('must not run'); }, 'it');
    const overhead = Buffer.byteLength(JSON.stringify({ text: '' }), 'utf8');
    const request = jsonPost({ text: 'x'.repeat(TURN_BODY_LIMIT - overhead + 1) });
    expect(Buffer.byteLength(request.payload, 'utf8')).toBe(65_537);
    const response = await server.inject(request);
    expect(response.statusCode).toBe(413);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ error: 'Richiesta troppo grande.' });
    expect(calls).toBe(0);
  });

  it('rejects a 65 537-byte chunked body without trusting Content-Length', async () => {
    let calls = 0;
    const server = fixture(async () => { calls += 1; throw new Error('must not run'); }, 'it');
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    const overhead = Buffer.byteLength(JSON.stringify({ text: '' }), 'utf8');
    const payload = JSON.stringify({ text: 'x'.repeat(TURN_BODY_LIMIT - overhead + 1) });
    expect(Buffer.byteLength(payload, 'utf8')).toBe(65_537);
    const response = await new Promise<{ status: number; type: string | undefined; body: string }>((resolve, reject) => {
      const request = httpRequest(`${address}/api/conversations/turns`, { method: 'POST',
        headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' } }, reply => {
        let body = '';
        reply.setEncoding('utf8');
        reply.on('data', chunk => { body += chunk; });
        reply.on('end', () => resolve({ status: reply.statusCode!,
          type: reply.headers['content-type'], body }));
      });
      request.on('error', reject);
      request.write(payload.slice(0, 32_768));
      request.end(payload.slice(32_768));
    });
    expect(response.status).toBe(413);
    expect(response.type).toMatch(/^application\/json/);
    expect(JSON.parse(response.body)).toEqual({ error: 'Richiesta troppo grande.' });
    expect(calls).toBe(0);
  });

  it('accepts a 65 536-byte JSON body for normal admission checks', async () => {
    let calls = 0;
    const server = fixture(async () => {
      calls += 1;
      return { ok: false, error: { kind: 'occupied' } };
    });
    const overhead = Buffer.byteLength(JSON.stringify({ text: '' }), 'utf8');
    const request = jsonPost({ text: 'x'.repeat(TURN_BODY_LIMIT - overhead) });
    expect(Buffer.byteLength(request.payload, 'utf8')).toBe(TURN_BODY_LIMIT);
    const response = await server.inject(request);
    expect(response.statusCode).toBe(409);
    expect(calls).toBe(1);
  });

  it('uses the configured standard 500 message before SSE admission', async () => {
    for (const [language, message] of [
      ['en', "I can't complete the response."],
      ['it', 'Non riesco a completare la risposta.'],
    ] as const) {
      const server = fixture(async () => { throw new Error('private database path'); }, language);
      const response = await server.inject(jsonPost({ text: 'hello' }));
      expect(response.statusCode).toBe(500);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ error: message });
      expect(response.body).not.toContain('private database path');
    }
  });

  it('keeps admission enabled after a failure before any turn was admitted', async () => {
    let calls = 0;
    const server = fixture(async () => {
      calls += 1;
      if (calls === 1) throw new Error('private admission failure');
      return { ok: false, error: { kind: 'occupied' } };
    });
    expect((await server.inject(jsonPost({ text: 'first' }))).statusCode).toBe(500);
    const second = await server.inject(jsonPost({ text: 'second' }));
    expect(second.statusCode).toBe(409);
    expect(calls).toBe(2);
  });

  it('normalizes admission failures without replacing an Error or stringifying unknown values', async () => {
    const cause = new Error('TECH_CAUSE_MARKER');
    const original = new Error('TECH_MESSAGE_MARKER', { cause });
    original.stack = 'TECH_STACK_MARKER';
    const project = new ProjectError('PROJECT_MESSAGE_MARKER', { cause });
    const unknown = { marker: 'TECH_ORIGINAL_MARKER' };
    const thrown: unknown[] = [original, project, unknown, 'TECH_STRING_MARKER'];
    const calls: unknown[][] = [];
    const warnings: unknown[][] = [];
    const { server, lines } = loggedFixture(async () => { throw thrown.shift(); });
    server.addHook('onRequest', (request, _reply, done) => {
      const error = vi.spyOn(request.log, 'error');
      const warn = vi.spyOn(request.log, 'warn');
      calls.push(error.mock.calls);
      warnings.push(warn.mock.calls);
      done();
    });
    const logged: { err: Error }[] = [];
    for (let index = 0; index < 4; index++) {
      const response = await server.inject(jsonPost({ text: 'hello' }));
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "I can't complete the response." });
      expect((calls.at(-1) as unknown[][])).toHaveLength(1);
      expect((warnings.at(-1) as unknown[][])).toHaveLength(0);
      logged.push((calls.at(-1) as unknown[][]).at(-1)![0] as { err: Error });
    }
    expect(logged[0]!.err).toBe(original);
    expect(logged[1]!.err).toBe(project);
    expect(original.cause).toBe(cause);
    expect(logged[2]!.err).toBeInstanceOf(Error);
    expect(logged[2]!.err.cause).toBe(unknown);
    expect(logged[3]!.err.cause).toBe('TECH_STRING_MARKER');
    expect(logged[2]!.err.message).toBe(logged[3]!.err.message);
    expect(original.stack).toBe('TECH_STACK_MARKER');
    expect(unknown).toEqual({ marker: 'TECH_ORIGINAL_MARKER' });
    expect(lines).toHaveLength(4);
    for (const line of lines) expectExplicitDiagnosticFields(line, 'conversation_turn_admission_failed');
  });

  it('keeps the HTTP error event name stable across different technical faults', async () => {
    const faults = ['first technical fault', 'second technical fault'];
    const { server, lines } = loggedFixture(async () => { throw new Error('exchange should not run'); });
    server.addHook('preValidation', async request => {
      if (request.url === '/api/conversations/turns') throw new Error(faults.shift());
    });
    for (const text of ['first', 'second']) {
      const response = await server.inject(jsonPost({ text }));
      expect(response.statusCode).toBe(500);
    }
    expect(lines).toHaveLength(2);
    for (const line of lines) expectExplicitDiagnosticFields(line, 'conversation_turn_http_failed');
  });

  it('keeps the completion error event name stable across different faults', async () => {
    const events: string[] = [];
    for (const text of ['first', 'second']) {
      const { server, lines } = loggedFixture(async (_input, observer) => {
        await observer?.admitted?.('conversation-1', 'turn-1');
        throw new Error(`${text} technical fault`);
      });
      const response = await server.inject(jsonPost({ text }));
      expect(response.statusCode).toBe(200);
      expect(uiParts(response.body).at(-1)).toEqual({ type: 'error',
        errorText: "I can't complete the response." });
      expect(lines).toHaveLength(1);
      expectExplicitDiagnosticFields(lines[0]!, 'conversation_turn_completion_failed');
      events.push((JSON.parse(lines[0]!) as { event: string }).event);
    }
    expect(events).toEqual(['conversation_turn_completion_failed',
      'conversation_turn_completion_failed']);
  });

  it('streams conversation identity, ordered deltas and committed success on the same POST', async () => {
    const server = fixture(async (input, observer) => {
      expect(input).toEqual({ text: 'hello' });
      await observer?.admitted?.('conversation-1', 'turn-1');
      await observer?.delta?.('Hel');
      await observer?.delta?.('lo');
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1', outcome: 'answered' } };
    });
    const response = await server.inject(jsonPost({ text: 'hello' }));
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(response.headers['x-vercel-ai-ui-message-stream']).toBe('v1');
    expect(response.headers['cache-control']).toBe('no-store');
    const parts = uiParts(response.body);
    expect(parts[0]).toEqual({ type: 'start', messageId: expect.any(String),
      messageMetadata: { conversationId: 'conversation-1', turnId: 'turn-1' } });
    expect(parts.slice(1)).toEqual([
      { type: 'text-start', id: 'turn-1' },
      { type: 'text-delta', id: 'turn-1', delta: 'Hel' },
      { type: 'text-delta', id: 'turn-1', delta: 'lo' },
      { type: 'text-end', id: 'turn-1' },
      { type: 'finish', finishReason: 'stop', messageMetadata: { turnStatus: 'answered' } },
    ]);
  });

  it('is readable by the official AI SDK chat transport, including Unicode and multiline text', async () => {
    const server = fixture(async (_input, observer) => {
      await observer?.admitted?.('conversation-1', 'turn-1');
      await observer?.delta?.('Ciao\n');
      await observer?.delta?.('😀');
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1',
        outcome: 'answered' } };
    });
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    const transport = new DefaultChatTransport<UIMessage>({
      api: `${address}/api/conversations/turns`,
      prepareSendMessagesRequest: () => ({ body: { text: 'ciao' } }),
    });
    const stream = await transport.sendMessages({ trigger: 'submit-message', chatId: 'test',
      messageId: undefined, messages: [{ id: 'user-1', role: 'user',
        parts: [{ type: 'text', text: 'ciao' }] }], abortSignal: undefined });
    const [chunkStream, messageStream] = stream.tee();
    const chunks: Array<{ type: string; [key: string]: unknown }> = [];
    for await (const chunk of chunkStream) chunks.push(chunk);
    expect(chunks[0]).toMatchObject({ type: 'start', messageMetadata: {
      conversationId: 'conversation-1', turnId: 'turn-1',
    } });
    expect(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.delta))
      .toEqual(['Ciao\n', '😀']);
    expect(chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'stop',
      messageMetadata: { turnStatus: 'answered' } });
    let final: UIMessage | undefined;
    for await (const message of readUIMessageStream<UIMessage>({ stream: messageStream })) {
      final = message;
    }
    expect(final?.parts).toEqual([expect.objectContaining({ type: 'text', text: 'Ciao\n😀' })]);
    expect(final?.metadata).toEqual({ conversationId: 'conversation-1', turnId: 'turn-1',
      turnStatus: 'answered' });
  });

  it('delivers the first delta while the reply producer is still waiting', async () => {
    let releaseSecond!: () => void;
    const secondReady = new Promise<void>(resolve => { releaseSecond = resolve; });
    const server = fixture(async (_input, observer) => {
      await observer?.admitted?.('conversation-1', 'turn-1');
      await observer?.delta?.('first');
      await secondReady;
      await observer?.delta?.('second');
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1', outcome: 'answered' } };
    });
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    try {
      const response = await fetch(`${address}/api/conversations/turns`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      });
      expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/);
      const reader = response.body!.getReader();
      const first = await reader.read();
      const firstText = new TextDecoder().decode(first.value);
      expect(firstText).toContain('"type":"start"');
      expect(firstText).toContain('"type":"text-delta","id":"turn-1","delta":"first"');
      expect(firstText).not.toContain('second');
      releaseSecond();
      let remaining = '';
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        remaining += new TextDecoder().decode(next.value);
      }
      expect(remaining).toContain('"type":"text-delta","id":"turn-1","delta":"second"');
      expect(remaining).toContain('"type":"finish","finishReason":"stop"');
      expect(remaining).toContain('data: [DONE]');
    } finally {
      releaseSecond();
    }
  });

  it('sends error without done when the admitted turn has a persisted failure', async () => {
    let calls = 0;
    const server = fixture(async (_input, observer) => {
      calls += 1;
      await observer?.admitted?.('conversation-1', `turn-${calls}`);
      if (calls === 1) {
        await observer?.delta?.('partial');
        return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1',
          outcome: 'failed', error: 'Non riesco a completare la risposta.' } };
      }
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-2', outcome: 'answered' } };
    }, 'it');
    const response = await server.inject(jsonPost({ text: 'ciao', conversationId: 'conversation-1' }));
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(uiParts(response.body).map(part => part.type)).toEqual([
      'start', 'text-start', 'text-delta', 'text-end', 'error',
    ]);
    expect(uiParts(response.body).at(-1)).toEqual({ type: 'error',
      errorText: 'Non riesco a completare la risposta.' });
    const next = await server.inject(jsonPost({ text: 'un altro turno', conversationId: 'conversation-1' }));
    expect(next.statusCode).toBe(200);
    expect(uiParts(next.body).at(-1)).toEqual({ type: 'finish', finishReason: 'stop',
      messageMetadata: { turnStatus: 'answered' } });
    expect(calls).toBe(2);
  });

  it('stops accepting turns after an admitted turn cannot finish and returns 503 until restart', async () => {
    let calls = 0;
    const server = fixture(async (_input, observer) => {
      calls += 1;
      await observer?.admitted?.('conversation-1', 'turn-1');
      await observer?.delta?.('partial');
      throw new Error('private persistence failure');
    }, 'it');
    const first = await server.inject(jsonPost({ text: 'ciao' }));
    expect(first.statusCode).toBe(200);
    expect(uiParts(first.body).at(-1)).toEqual({ type: 'error',
      errorText: 'Non riesco a completare la risposta.' });
    expect(first.body).not.toContain('"type":"finish"');
    expect(first.body).not.toContain('private persistence failure');

    const blocked = await server.inject(jsonPost({ text: 'ancora' }));
    expect(blocked.statusCode).toBe(503);
    expect(blocked.headers['content-type']).toMatch(/^application\/json/);
    expect(blocked.headers['cache-control']).toBe('no-store');
    expect(blocked.json()).toEqual({ error: 'Servizio temporaneamente non disponibile.' });
    expect(calls).toBe(1);
    const malformed = await server.inject(post('{broken'));
    expect(malformed.statusCode).toBe(503);
    expect(malformed.json()).toEqual({ error: 'Servizio temporaneamente non disponibile.' });

    let restartedCalls = 0;
    const restarted = fixture(async () => {
      restartedCalls += 1;
      return { ok: false, error: { kind: 'occupied' } };
    }, 'it');
    const afterRestart = await restarted.inject(jsonPost({ text: 'nuovo' }));
    expect(afterRestart.statusCode).toBe(409);
    expect(restartedCalls).toBe(1);
  });

  it('keeps a completion failure out of public SSE and emits one definitive diagnostic', async () => {
    const lines: string[] = [];
    const original = { marker: 'TECH_ORIGINAL_MARKER' };
    const cause = new Error('TECH_CAUSE_MARKER', { cause: original });
    const failure = new ProjectError('TECH_MESSAGE_MARKER', { cause });
    failure.stack = 'TECH_STACK_MARKER';
    const diagnosticCalls: unknown[][][] = [];
    const warningCalls: unknown[][][] = [];
    const server = Fastify({ logger: { level: 'error',
      stream: new Writable({ write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      } }),
      serializers: { err: () => ({ type: 'Error', message: 'Unexpected HTTP failure',
        stack: '[redacted]' }) },
    } });
    servers.push(server);
    registerTurnRoute(server, { language: 'en', exchange: async (_input, observer) => {
      await observer?.admitted?.('conversation-1', 'turn-1');
      throw failure;
    } });
    server.addHook('onRequest', (request, _reply, done) => {
      diagnosticCalls.push(vi.spyOn(request.log, 'error').mock.calls);
      warningCalls.push(vi.spyOn(request.log, 'warn').mock.calls);
      done();
    });
    const response = await server.inject(jsonPost({ text: 'hello' }));
    expect(response.statusCode).toBe(200);
    expect(uiParts(response.body).at(-1)).toEqual({ type: 'error',
      errorText: "I can't complete the response." });
    expect(response.body).not.toContain('"type":"finish"');
    expect(response.body).not.toMatch(/TECH_(?:MESSAGE|STACK|CAUSE|ORIGINAL)_MARKER/);
    expect(diagnosticCalls).toHaveLength(1);
    expect(diagnosticCalls[0]).toHaveLength(1);
    expect(warningCalls).toEqual([[]]);
    expect((diagnosticCalls[0]![0]![0] as { err: Error }).err).toBe(failure);
    expect(failure.cause).toBe(cause);
    expect(cause.cause).toBe(original);
    expect(lines).toHaveLength(1);
    const logged = JSON.parse(lines[0]!) as { event: string; msg: string; err: { message: string } };
    expect(logged.event).toBe('conversation_turn_completion_failed');
    expect(logged.msg).toBe('Conversation turn completion failed');
    expect(logged.err.message).toBe('Unexpected HTTP failure');
    expect(lines[0]).not.toMatch(/TECH_(?:MESSAGE|STACK|CAUSE|ORIGINAL)_MARKER/);
  });

  it('confirms success only after the application completion resolves', async () => {
    let releaseCommit!: () => void;
    const commit = new Promise<void>(resolve => { releaseCommit = resolve; });
    const server = fixture(async (_input, observer) => {
      await observer?.admitted?.('conversation-1', 'turn-1');
      await observer?.delta?.('partial');
      await commit;
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1',
        outcome: 'answered' } };
    });
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    try {
      const response = await fetch(`${address}/api/conversations/turns`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      });
      const reader = response.body!.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      expect(first).toContain('"type":"text-delta"');
      expect(first).not.toContain('"type":"finish"');
      releaseCommit();
      let rest = '';
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        rest += new TextDecoder().decode(next.value);
      }
      expect(rest).toContain('"type":"finish","finishReason":"stop"');
    } finally { releaseCommit(); }
  });

  it('does not log a normal SSE client disconnection as a delivery failure', async () => {
    let release!: () => void;
    const continueTurn = new Promise<void>(resolve => { release = resolve; });
    let completed!: () => void;
    const turnCompleted = new Promise<void>(resolve => { completed = resolve; });
    const { server, lines } = loggedFixture(async (_input, observer) => {
      await observer?.admitted?.('conversation-1', 'turn-1');
      await observer?.delta?.('first');
      await continueTurn;
      await observer?.delta?.('second');
      completed();
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1',
        outcome: 'answered' } };
    });
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    try {
      const response = await fetch(`${address}/api/conversations/turns`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      });
      const reader = response.body!.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      expect(first).toContain('"type":"text-delta","id":"turn-1","delta":"first"');
      await reader.cancel();
      release();
      await turnCompleted;
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(lines).toEqual([]);
    } finally {
      release();
    }
  });

  it('logs a technical SSE stream failure while the admitted turn completes', async () => {
    const delivered = new Error('private delivery marker');
    let signalFailed!: () => void;
    const streamFailed = new Promise<void>(resolve => { signalFailed = resolve; });
    let finish!: () => void;
    const completed = new Promise<void>(resolve => { finish = resolve; });
    const originalFrom = Readable.from;
    vi.spyOn(Readable, 'from').mockImplementationOnce((iterable, options) => {
      const stream = originalFrom(iterable, options);
      stream.once('data', () => { stream.destroy(delivered); signalFailed(); });
      return stream;
    });
    const { server, lines } = loggedFixture(async (_input, observer) => {
      await observer?.admitted?.('conversation-1', 'turn-1');
      await observer?.delta?.('first');
      await streamFailed;
      await observer?.delta?.('second');
      finish();
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1',
        outcome: 'answered' } };
    });
    await server.inject(jsonPost({ text: 'hello' })).catch(() => undefined);
    await completed;
    await new Promise<void>(resolve => setImmediate(resolve));
    const diagnostics = lines.map(line => JSON.parse(line) as Record<string, unknown>)
      .filter(row => row.event === 'conversation_turn_sse_delivery_failed');
    expect(diagnostics).toHaveLength(1);
    expectExplicitDiagnosticFields(lines.find(line => line.includes('conversation_turn_sse_delivery_failed'))!,
      'conversation_turn_sse_delivery_failed');
    expect(lines.some(line => line.includes('conversation_turn_completion_failed'))).toBe(false);
    expect(lines.join('')).not.toContain('private delivery marker');
  });
});
