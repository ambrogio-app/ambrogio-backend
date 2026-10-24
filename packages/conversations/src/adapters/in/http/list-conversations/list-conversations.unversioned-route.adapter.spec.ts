import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerUnversionedListConversationsRoute } from './list-conversations.unversioned-route.adapter.js';
import { createListConversationsHandler } from './list-conversations.handler.js';
import { createListConversations } from '../../../../application/list-conversations.use-case.js';
import { ProjectError } from '../../../../application/project-error.js';
import type { ListConversations } from '../../../../application/list-conversations.use-case.js';
import { routeServer } from '../../../../../test/support/http-routes.js';
import { recordingLogger } from '../../../../../test/support/recording-logger.js';

const servers: FastifyInstance[] = [];
let recorder = recordingLogger();

function fixture(listConversations: ListConversations, maxPageSize = 100, language: 'en' | 'it' = 'en') {
  const server = routeServer('/api', scope => registerUnversionedListConversationsRoute(scope,
    createListConversationsHandler({ listConversations, maxPageSize }), language, recorder.log));
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('conversation list HTTP ingress of the API without a version', () => {
  // Verification: Prova dell'API HTTP senza versione
  it('returns a page and passes its opaque cursor and explicit limit to the next read', async () => {
    const inputs: Parameters<ListConversations>[0][] = [];
    const server = fixture(async input => {
      inputs.push(input);
      if (inputs.length === 1) return { items: [
        { id: 'a', lastActivityAt: new Date(2000) },
        { id: 'b', lastActivityAt: new Date(1000) },
      ], next: { id: 'b', lastActivityAt: new Date(1000) } };
      return { items: [{ id: 'c', lastActivityAt: new Date(500) }] };
    }, 3);
    const first = await server.inject({ method: 'GET', url: '/api/conversations?limit=2' });
    expect(first.statusCode).toBe(200);
    expect(first.headers['content-type']).toMatch(/^application\/json/);
    expect(first.headers['cache-control']).toBe('no-store');
    const firstBody = first.json();
    expect(firstBody.items).toEqual([
      { id: 'a', lastActivityAt: '1970-01-01T00:00:02.000Z' },
      { id: 'b', lastActivityAt: '1970-01-01T00:00:01.000Z' },
    ]);
    expect(Buffer.from(firstBody.nextCursor, 'base64url').toString('utf8'))
      .toBe('{"id":"b","lastActivityAt":"1970-01-01T00:00:01.000Z"}');

    const second = await server.inject({ method: 'GET',
      url: `/api/conversations?cursor=${encodeURIComponent(firstBody.nextCursor)}&limit=1` });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ items: [
      { id: 'c', lastActivityAt: '1970-01-01T00:00:00.500Z' },
    ], nextCursor: null });
    expect(inputs).toEqual([
      { limit: 2 },
      { after: { id: 'b', lastActivityAt: new Date(1000) }, limit: 1 },
    ]);
  });

  // Verification: Prova dell'API HTTP senza versione
  it('accepts only the canonical UTC instant it produced in a cursor', async () => {
    const calls: Parameters<ListConversations>[0][] = [];
    const server = fixture(async input => { calls.push(input); return { items: [] }; });
    const cursor = (lastActivityAt: string) => Buffer.from(JSON.stringify({ id: 'b', lastActivityAt }), 'utf8')
      .toString('base64url');
    for (const instant of ['1970-01-01T01:00:01.000+01:00', '1970-01-01T00:00:01Z', '1970-01-01T00:00:01.000z',
      '1970-01-01 00:00:01.000Z', '1970-01-01T00:00:01.000']) {
      const response = await server.inject({ method: 'GET', url: `/api/conversations?cursor=${cursor(instant)}` });
      expect(response.statusCode, instant).toBe(400);
    }
    expect(calls).toEqual([]);
    const accepted = await server.inject({ method: 'GET', url: `/api/conversations?cursor=${cursor('1970-01-01T00:00:01.000Z')}` });
    expect(accepted.statusCode).toBe(200);
    expect(calls).toEqual([{ after: { id: 'b', lastActivityAt: new Date(1000) } }]);
  });

  it('returns an empty first page with no next cursor', async () => {
    const server = fixture(async input => {
      expect(input).toEqual({});
      return { items: [] };
    });
    const response = await server.inject({ method: 'GET', url: '/api/conversations' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], nextCursor: null });
  });

  it('rejects malformed cursor and invalid limits before calling the use case', async () => {
    let calls = 0;
    const server = fixture(async () => { calls += 1; return { items: [] }; }, 3, 'it');
    const badCursor = Buffer.from('{"id":"a","lastActivityAt":"bad"}').toString('base64url');
    for (const url of [
      '/api/conversations?cursor=%25',
      `/api/conversations?cursor=${badCursor}`,
      '/api/conversations?limit=0',
      '/api/conversations?limit=4',
      '/api/conversations?limit=1.5',
      '/api/conversations?limit=2&limit=3',
      '/api/conversations?unexpected=1',
    ]) {
      const response = await server.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.json()).toEqual({ error: 'Richiesta di paginazione non valida.' });
    }
    expect(calls).toBe(0);
  });

  it('logs a failed read and returns a safe localized 500', async () => {
    const server = fixture(async () => { throw new Error('private database path'); }, 3, 'it');
    const response = await server.inject({ method: 'GET', url: '/api/conversations' });
    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ error: 'Non riesco a completare la risposta.' });
    expect(response.body).not.toContain('private database path');
  });

  it('normalizes unknown failures only at the HTTP boundary', async () => {
    const cause = new Error('TECH_CAUSE_MARKER');
    const original = new TypeError('TECH_MESSAGE_MARKER', { cause });
    original.stack = 'TECH_STACK_MARKER';
    const project = new ProjectError('PROJECT_MESSAGE_MARKER', { cause });
    const unknown = { marker: 'TECH_ORIGINAL_MARKER' };
    const thrown: unknown[] = [original, project, unknown, 'TECH_STRING_MARKER'];
    recorder = recordingLogger();
    const server = fixture(createListConversations({ async page() { throw thrown.shift(); } }));
    const logged: { err: Error }[] = [];
    const ids: string[] = [];
    for (let index = 0; index < 4; index++) {
      const response = await server.inject({ method: 'GET', url: '/api/conversations' });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "I can't complete the response." });
      // One definitive error per failure, through a logger derived with the request's correlation identifier.
      expect(recorder.events).toHaveLength(index + 1);
      const event = recorder.events.at(-1)!;
      expect(event.level).toBe('error');
      expect(Object.keys(event.bindings)).toEqual(['correlationId']);
      ids.push(event.bindings.correlationId as string);
      logged.push(event.fields as { err: Error });
    }
    expect(new Set(ids).size).toBe(4);
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
