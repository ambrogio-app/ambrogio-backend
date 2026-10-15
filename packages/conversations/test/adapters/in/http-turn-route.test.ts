import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
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
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('text turn HTTP ingress', () => {
  it('rejects empty text before a missing conversation, malformed JSON and unsupported fields', async () => {
    let calls = 0;
    const server = fixture(async () => { calls += 1; throw new Error('must not run'); });
    for (const request of [
      jsonPost({ text: '   ', conversationId: 'missing' }),
      post('{broken'),
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
    expect(calls).toBe(0);
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

  it('caps the actual JSON body at 64 KiB before admission', async () => {
    let calls = 0;
    const server = fixture(async () => { calls += 1; throw new Error('must not run'); }, 'it');
    const request = jsonPost({ text: 'x'.repeat(TURN_BODY_LIMIT) });
    const response = await server.inject(request);
    expect(response.statusCode).toBe(413);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.json()).toEqual({ error: 'Richiesta troppo grande.' });
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

  it('streams conversation identity, ordered deltas and done on the same POST', async () => {
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
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toBe(
      'event: conversation\ndata: {"conversationId":"conversation-1"}\n\n'
      + 'event: delta\ndata: {"text":"Hel"}\n\n'
      + 'event: delta\ndata: {"text":"lo"}\n\n'
      + 'event: done\ndata: {}\n\n',
    );
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
      expect(firstText).toContain('event: conversation');
      expect(firstText).toContain('event: delta\ndata: {"text":"first"}\n\n');
      expect(firstText).not.toContain('second');
      releaseSecond();
      let remaining = '';
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        remaining += new TextDecoder().decode(next.value);
      }
      expect(remaining).toContain('event: delta\ndata: {"text":"second"}\n\n');
      expect(remaining).toMatch(/event: done\ndata: \{\}\n\n$/);
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
    expect(response.body).toBe('event: delta\ndata: {"text":"partial"}\n\n'
      + 'event: error\ndata: {"error":"Non riesco a completare la risposta."}\n\n');
    const next = await server.inject(jsonPost({ text: 'un altro turno', conversationId: 'conversation-1' }));
    expect(next.statusCode).toBe(200);
    expect(next.body).toBe('event: done\ndata: {}\n\n');
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
    expect(first.body).toContain('event: error\ndata: {"error":"Non riesco a completare la risposta."}\n\n');
    expect(first.body).not.toContain('event: done');
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
});
