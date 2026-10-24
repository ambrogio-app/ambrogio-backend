import type { FastifyInstance } from 'fastify';
import { Ajv } from 'ajv';
import { afterEach, describe, expect, it } from 'vitest';
import { registerGetConversationRoute } from './get-conversation.route.adapter.js';
import { createGetConversationHandler } from './get-conversation.handler.js';
import { conversationNotFoundProblemSchema, conversationSchema } from './get-conversation.schemas.js';
import { methodNotAllowedProblemSchema } from '../problem-details.js';
import type { GetConversation } from '../../../../application/get-conversation.use-case.js';
import { routeServer } from '../../../../../test/support/http-routes.js';

const servers: FastifyInstance[] = [];
const ajv = new Ajv({ strict: false });
const isConversation = ajv.compile(conversationSchema);
const isNotFound = ajv.compile(conversationNotFoundProblemSchema);
const isMethodNotAllowed = ajv.compile(methodNotAllowedProblemSchema);

function fixture(getConversation: GetConversation) {
  const server = routeServer('/api/v1', scope => registerGetConversationRoute(scope,
    createGetConversationHandler(getConversation)));
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('conversation history route of HTTP API v1', () => {
  // Verification: Prova degli istanti ai confini HTTP
  // Verification: Prova della lettura HTTP dello storico conversazionale
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
    const response = await server.inject({ method: 'GET', url: '/api/v1/conversations/conversation-1' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(isConversation(response.json())).toBe(true);
    expect(response.json()).toEqual({
      id: 'conversation-1', createdAt: '1970-01-01T00:00:01.000Z', lastActivityAt: '1970-01-01T00:00:04.000Z',
      turns: [
        { id: 'turn-1', text: ' first ', acceptedAt: '1970-01-01T00:00:01.000Z',
          status: 'answered', answer: 'answer', finishedAt: '1970-01-01T00:00:02.000Z' },
        { id: 'turn-2', text: 'second', acceptedAt: '1970-01-01T00:00:03.000Z',
          status: 'failed', error: 'Public error.', finishedAt: '1970-01-01T00:00:03.500Z' },
        { id: 'turn-3', text: 'third', acceptedAt: '1970-01-01T00:00:03.800Z',
          status: 'interrupted', finishedAt: '1970-01-01T00:00:03.900Z' },
        { id: 'turn-4', text: 'fourth', acceptedAt: '1970-01-01T00:00:04.000Z', status: 'pending' },
      ],
    });
  });

  // Verification: Prova della lettura HTTP dello storico conversazionale
  it('maps the missing conversation to its own problem, independent of the configured language', async () => {
    const server = fixture(async () => ({ ok: false, error: { kind: 'conversation_not_found' } }));
    const response = await server.inject({ method: 'GET', url: '/api/v1/conversations/missing' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(isNotFound(response.json())).toBe(true);
    expect(response.json()).toEqual({ type: '/problems/conversation-not-found', title: 'Conversation not found',
      status: 404 });
  });

  // Verification: Prova degli esiti pubblici dell'API HTTP
  it('answers 405 with Allow to the methods it does not accept', async () => {
    const server = fixture(async () => ({ ok: false, error: { kind: 'conversation_not_found' } }));
    const response = await server.inject({ method: 'DELETE', url: '/api/v1/conversations/c-1' });
    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toBe('GET, HEAD');
    expect(isMethodNotAllowed(response.json())).toBe(true);
  });
});
