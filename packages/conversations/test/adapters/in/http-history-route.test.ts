import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerHistoryRoute } from '../../../src/adapters/in/http/history-route.js';
import type { GetConversation } from '../../../src/application/get-conversation.use-case.js';

const servers: ReturnType<typeof Fastify>[] = [];

function fixture(getConversation: GetConversation, language: 'en' | 'it' = 'en') {
  const server = Fastify();
  servers.push(server);
  registerHistoryRoute(server, { getConversation, language });
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('conversation history HTTP ingress', () => {
  it('returns the complete ordered snapshot with state-specific fields and UTC instants', async () => {
    const server = fixture(async ({ conversationId }) => {
      expect(conversationId).toBe('conversation-1');
      return { ok: true, value: {
        id: conversationId, createdAt: new Date(1000), lastActivityAt: new Date(4000),
        turns: [
          { id: 'turn-1', text: ' first ', acceptedAt: new Date(1000), status: 'answered',
            answer: 'answer', finishedAt: new Date(2000) },
          { id: 'turn-2', text: 'second', acceptedAt: new Date(3000), status: 'failed',
            error: 'Public error.', finishedAt: new Date(3500) },
          { id: 'turn-3', text: 'third', acceptedAt: new Date(3800), status: 'interrupted',
            finishedAt: new Date(3900) },
          { id: 'turn-4', text: 'fourth', acceptedAt: new Date(4000), status: 'pending' },
        ],
      } };
    });
    const response = await server.inject({ method: 'GET', url: '/api/conversations/conversation-1' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      id: 'conversation-1', createdAt: '1970-01-01T00:00:01.000Z',
      lastActivityAt: '1970-01-01T00:00:04.000Z',
      turns: [
        { id: 'turn-1', text: ' first ', acceptedAt: '1970-01-01T00:00:01.000Z',
          status: 'answered', answer: 'answer', finishedAt: '1970-01-01T00:00:02.000Z' },
        { id: 'turn-2', text: 'second', acceptedAt: '1970-01-01T00:00:03.000Z',
          status: 'failed', error: 'Public error.', finishedAt: '1970-01-01T00:00:03.500Z' },
        { id: 'turn-3', text: 'third', acceptedAt: '1970-01-01T00:00:03.800Z',
          status: 'interrupted', finishedAt: '1970-01-01T00:00:03.900Z' },
        { id: 'turn-4', text: 'fourth', acceptedAt: '1970-01-01T00:00:04.000Z',
          status: 'pending' },
      ],
    });
  });

  it('returns a localized 404 for a missing conversation', async () => {
    const server = fixture(async () => ({ ok: false, error: { kind: 'conversation_not_found' } }), 'it');
    const response = await server.inject({ method: 'GET', url: '/api/conversations/missing' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ error: 'Conversazione non trovata.' });
  });

  it('logs a failed read and returns a safe localized 500', async () => {
    const server = fixture(async () => { throw new Error('private database path'); }, 'it');
    const response = await server.inject({ method: 'GET', url: '/api/conversations/broken' });
    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ error: 'Non riesco a completare la risposta.' });
    expect(response.body).not.toContain('private database path');
  });
});
