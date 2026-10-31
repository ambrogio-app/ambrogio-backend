import type { FastifyInstance } from 'fastify';
import { Ajv } from 'ajv';
import { afterEach, describe, expect, it } from 'vitest';
import { registerListConversationsRoute } from './list-conversations.route.adapter.js';
import { conversationPageSchema, invalidPaginationProblemSchema } from './list-conversations.schemas.js';
import { methodNotAllowedProblemSchema } from '../problem-details.js';
import type { ListConversations } from '../../../../application/list-conversations/list-conversations.use-case.js';
import { routeServer } from '../../../../../test/support/http-routes.js';

const servers: FastifyInstance[] = [];
const ajv = new Ajv({ strict: false });
const isPage = ajv.compile(conversationPageSchema);
const isInvalidPagination = ajv.compile(invalidPaginationProblemSchema);
const isMethodNotAllowed = ajv.compile(methodNotAllowedProblemSchema);

function fixture(listConversations: ListConversations, maxPageSize = 100) {
  const server = routeServer('/api/v1', scope => registerListConversationsRoute(scope,
    { listConversations, maxPageSize }));
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('conversation list route of HTTP API v1', () => {
  // Verification: Prova degli istanti ai confini HTTP
  // Verification: Prova della lettura HTTP dell'elenco conversazioni
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
    const first = await server.inject({ method: 'GET', url: '/api/v1/conversations?limit=2' });
    expect(first.statusCode).toBe(200);
    expect(first.headers['content-type']).toMatch(/^application\/json/);
    expect(first.headers['cache-control']).toBe('no-store');
    const firstBody = first.json();
    expect(isPage(firstBody)).toBe(true);
    expect(firstBody.items).toEqual([
      { id: 'a', lastActivityAt: '1970-01-01T00:00:02.000Z' },
      { id: 'b', lastActivityAt: '1970-01-01T00:00:01.000Z' },
    ]);
    expect(Buffer.from(firstBody.nextCursor, 'base64url').toString('utf8'))
      .toBe('{"id":"b","lastActivityAt":"1970-01-01T00:00:01.000Z"}');
    const second = await server.inject({ method: 'GET',
      url: `/api/v1/conversations?cursor=${encodeURIComponent(firstBody.nextCursor)}&limit=1` });
    expect(second.json()).toEqual({ items: [{ id: 'c', lastActivityAt: '1970-01-01T00:00:00.500Z' }], nextCursor: null });
    expect(inputs).toEqual([{ limit: 2 }, { after: { id: 'b', lastActivityAt: new Date(1000) }, limit: 1 }]);
  });

  // Verification: Prova degli istanti ai confini HTTP
  it('accepts only the canonical UTC instant it produced in a cursor', async () => {
    const calls: Parameters<ListConversations>[0][] = [];
    const server = fixture(async input => { calls.push(input); return { items: [] }; });
    const cursor = (lastActivityAt: string) => Buffer.from(JSON.stringify({ id: 'b', lastActivityAt }), 'utf8')
      .toString('base64url');
    for (const instant of ['1970-01-01T01:00:01.000+01:00', '1970-01-01T00:00:01Z', '1970-01-01 00:00:01.000Z']) {
      const response = await server.inject({ method: 'GET', url: `/api/v1/conversations?cursor=${cursor(instant)}` });
      expect(response.statusCode, instant).toBe(400);
      expect(response.json().type).toBe('/problems/invalid-pagination');
    }
    expect(calls).toEqual([]);
    const accepted = await server.inject({ method: 'GET',
      url: `/api/v1/conversations?cursor=${cursor('1970-01-01T00:00:01.000Z')}` });
    expect(accepted.statusCode).toBe(200);
    expect(calls).toEqual([{ after: { id: 'b', lastActivityAt: new Date(1000) } }]);
  });

  // Verification: Prova della lettura HTTP dell'elenco conversazioni
  it('answers an unacceptable cursor or limit with its own problem before calling the use case', async () => {
    let calls = 0;
    const server = fixture(async () => { calls += 1; return { items: [] }; }, 3);
    const badCursor = Buffer.from('{"id":"a","lastActivityAt":"bad"}').toString('base64url');
    for (const query of ['cursor=%25', `cursor=${badCursor}`, 'limit=0', 'limit=4', 'limit=1.5', 'limit=abc']) {
      const response = await server.inject({ method: 'GET', url: `/api/v1/conversations?${query}` });
      expect(response.statusCode, query).toBe(400);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(isInvalidPagination(response.json()), query).toBe(true);
    }
    expect(calls).toBe(0);
  });

  // Verification: Prova degli esiti pubblici dell'API HTTP
  it('answers 405 with Allow to the methods it does not accept', async () => {
    const server = fixture(async () => ({ items: [] }));
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const response = await server.inject({ method, url: '/api/v1/conversations' });
      expect(response.statusCode, method).toBe(405);
      expect(response.headers.allow).toBe('GET, HEAD');
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(isMethodNotAllowed(response.json())).toBe(true);
    }
    expect((await server.inject({ method: 'HEAD', url: '/api/v1/conversations' })).statusCode).toBe(200);
  });

  it('lets a failed read reach the central error handling', async () => {
    const server = fixture(async () => { throw new Error('private database path'); });
    const response = await server.inject({ method: 'GET', url: '/api/v1/conversations' });
    // Without the application's central handler Fastify answers with its own 500; the route adds nothing.
    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).not.toMatch(/problem/);
  });
});
