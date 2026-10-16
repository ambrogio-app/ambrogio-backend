import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerListRoute } from '../../../src/adapters/in/http/list-route.js';
import { httpAjvOptions } from '../../../src/adapters/in/http/http-validation.js';
import { createListConversations } from '../../../src/application/list-conversations.use-case.js';
import { ProjectError } from '../../../src/project-error.js';
import type { ListConversations } from '../../../src/application/list-conversations.use-case.js';

const servers: ReturnType<typeof Fastify>[] = [];

function fixture(listConversations: ListConversations, maxPageSize = 100, language: 'en' | 'it' = 'en') {
  const server = Fastify({ ajv: { customOptions: httpAjvOptions } });
  servers.push(server);
  registerListRoute(server, { listConversations, maxPageSize, language });
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('conversation list HTTP ingress', () => {
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
    const logs: unknown[][] = [];
    const warnings: unknown[][] = [];
    const server = fixture(createListConversations({ async page() { throw thrown.shift(); } }));
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
      const response = await server.inject({ method: 'GET', url: '/api/conversations' });
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
