import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerUnversionedGetConversationRoute } from './get-conversation.unversioned-route.adapter.js';
import { createGetConversationHandler } from './get-conversation.handler.js';
import { createGetConversation } from '../../../../application/get-conversation.use-case.js';
import { ProjectError } from '../../../../project-error.js';
import type { GetConversation } from '../../../../application/get-conversation.use-case.js';
import { routeServer } from '../../../../../test/support/http-routes.js';

const servers: FastifyInstance[] = [];

function fixture(getConversation: GetConversation, language: 'en' | 'it' = 'en') {
  const server = routeServer('/api', scope => registerUnversionedGetConversationRoute(scope,
    createGetConversationHandler(getConversation), language));
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('conversation history HTTP ingress of the API without a version', () => {
  // Verification: Prova dell'API HTTP senza versione
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

  it('rejects an empty identifier with the generic JSON error of the API without a version', async () => {
    let calls = 0;
    const server = fixture(async () => { calls += 1; return { ok: false, error: { kind: 'conversation_not_found' } }; });
    const response = await server.inject({ method: 'GET', url: '/api/conversations/' });
    expect(response.statusCode).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ error: 'Invalid HTTP request.' });
    expect(calls).toBe(0);
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

  it('normalizes unknown failures only at the HTTP boundary', async () => {
    const cause = new Error('TECH_CAUSE_MARKER');
    const original = new Error('TECH_MESSAGE_MARKER', { cause });
    original.stack = 'TECH_STACK_MARKER';
    const project = new ProjectError('PROJECT_MESSAGE_MARKER', { cause });
    const unknown = { marker: 'TECH_ORIGINAL_MARKER' };
    const thrown: unknown[] = [original, project, unknown, 'TECH_STRING_MARKER'];
    const logs: unknown[][] = [];
    const warnings: unknown[][] = [];
    const server = fixture(createGetConversation({ async find() { throw thrown.shift(); } }));
    server.addHook('onRequest', (request, _reply, done) => {
      const error = vi.spyOn(request.log, 'error');
      const warn = vi.spyOn(request.log, 'warn');
      logs.push(error.mock.calls);
      warnings.push(warn.mock.calls);
      done();
    });
    const logged: { err: Error }[] = [];
    for (let index = 0; index < 4; index++) {
      const previousErrors = (logs.at(-1) as unknown[][] | undefined)?.length ?? 0;
      const previousWarnings = (warnings.at(-1) as unknown[][] | undefined)?.length ?? 0;
      const response = await server.inject({ method: 'GET', url: '/api/conversations/broken' });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "I can't complete the response." });
      expect((logs.at(-1) as unknown[][])).toHaveLength(previousErrors + 1);
      expect((warnings.at(-1) as unknown[][])).toHaveLength(previousWarnings);
      logged.push((logs.at(-1) as unknown[][]).at(-1)![0] as { err: Error });
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
  });
});
