import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import { HTTP_BODY_LIMIT_BYTES } from '../runtime/http-server.js';
import { Ajv } from 'ajv';
import { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import { prepareConfiguredConversations } from './conversations.js';
import { buildConversationServer } from './http-surface.js';
import { surfaceOptions } from '../../test/support/logger-fixture.js';
import { emptyTestDatabase } from '../../../../test/support/test-database.js';

const databases: Array<() => Promise<void>> = [];
const conversationId = '0c1e2f30-4152-4637-8899-aabbccddeeff';
const servers: FastifyInstance[] = [];
const archives: { close(): Promise<void> }[] = [];

const producer: ProduceConversationReply = { async *produce() {
  yield { kind: 'text', text: 'ok' };
  yield { kind: 'reply_expectation', expectsReply: false };
} };

// Independent JSON schemas of the problems of «Catalogo dei problemi di protocollo HTTP» and of the routes.
const fixed = (type: string, title: string, status: number, detail?: string) => ({
  type: 'object', additionalProperties: false,
  required: ['type', 'title', 'status', ...(detail === undefined ? [] : ['detail'])],
  properties: { type: { const: type }, title: { const: title }, status: { const: status },
    ...(detail === undefined ? {} : { detail: { const: detail } }) },
});
const requestValidation = {
  type: 'object', additionalProperties: false, required: ['type', 'title', 'status', 'errors'],
  properties: { type: { const: '/problems/request-validation' }, title: { const: 'Request validation failed' },
    status: { const: 400 }, errors: { type: 'array', minItems: 1, items: {
      type: 'object', additionalProperties: false, required: ['location', 'pointer', 'code', 'detail'],
      properties: { location: { enum: ['body', 'query', 'path', 'header'] }, pointer: { type: 'string' },
        code: { enum: ['unknown-field', 'invalid-value'] }, detail: { type: 'string' } } } } },
};
const ajv = new Ajv({ strict: true });
const problems = {
  badRequest: ajv.compile(fixed('about:blank', 'Bad Request', 400)),
  notFound: ajv.compile(fixed('about:blank', 'Not Found', 404)),
  methodNotAllowed: ajv.compile(fixed('about:blank', 'Method Not Allowed', 405)),
  contentTooLarge: ajv.compile(fixed('about:blank', 'Content Too Large', 413)),
  unsupportedMediaType: ajv.compile(fixed('about:blank', 'Unsupported Media Type', 415)),
  malformedJson: ajv.compile(fixed('/problems/malformed-json', 'Malformed JSON', 400,
    'The request body is not valid JSON.')),
  requestValidation: ajv.compile(requestValidation),
  originNotAllowed: ajv.compile(fixed('/problems/origin-not-allowed', 'Origin not allowed', 403)),
  unsupportedSubprotocol: ajv.compile(fixed('/problems/unsupported-subprotocol', 'Unsupported subprotocol', 400)),
  internalServerError: ajv.compile(fixed('about:blank', 'Internal Server Error', 500)),
  conversationNotFound: ajv.compile(fixed('/problems/conversation-not-found', 'Conversation not found', 404)),
  invalidPagination: ajv.compile(fixed('/problems/invalid-pagination', 'Invalid pagination request', 400,
    'The cursor or the limit is not valid.')),
};

/** The server composed as in production, on an archive with one conversation `conversationId`. */
async function composed(language: 'en' | 'it' = 'it') {
  const database = await emptyTestDatabase();
  databases.push(() => database.drop());
  const prepared = await prepareConfiguredConversations({ databaseUrl: database.url,
    listPageSize: 20, maxListPageSize: 100, historyTurns: 20, language, timeZone: 'UTC' }, new Date(), () => undefined);
  archives.push(prepared.archive);
  await prepared.archive.db.insertInto('conversations')
    .values({ id: conversationId, created_at: new Date(100), last_activity_at: new Date(100) }).execute();
  const surface = surfaceOptions();
  const { server } = await buildConversationServer({ host: '127.0.0.1', port: 0,
    allowedOrigins: ['https://client.test'], publicHttps: false }, prepared, producer, undefined, undefined, surface);
  servers.push(server);
  return { server, prepared, events: surface.events };
}

function expectProblem(response: { statusCode: number; headers: Record<string, unknown>; json(): unknown },
  status: number, isValid: (value: unknown) => boolean) {
  expect(response.statusCode).toBe(status);
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  expect(response.headers['cache-control']).toBe('no-store');
  const body = response.json();
  expect(isValid(body), JSON.stringify(body)).toBe(true);
  return body as Record<string, unknown>;
}

/** Ask for a WebSocket upgrade and return the HTTP response that rejects it. */
function rejectedUpgrade(port: number, protocol: string, origin?: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/session`, [protocol], origin ? { origin } : {});
  return new Promise<{ statusCode: number; headers: Record<string, unknown>; json(): unknown }>((resolve, reject) => {
    socket.once('unexpected-response', (_request, response) => {
      let body = '';
      response.on('data', chunk => { body += String(chunk); });
      response.on('end', () => {
        socket.terminate();
        resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, json: () => JSON.parse(body) });
      });
    });
    socket.once('open', () => { socket.close(); reject(new Error('upgrade accepted')); });
    socket.once('error', reject);
  });
}

/** Every registered route as `METHOD /full/path`, rebuilt from the indented route tree. */
function registeredRoutes(server: FastifyInstance): string[] {
  const stack: string[] = [];
  const routes: string[] = [];
  for (const line of server.printRoutes({ commonPrefix: false }).split('\n')) {
    const match = /^([│ ]*)[└├]── (\S+)(?: \(([^)]*)\))?$/.exec(line);
    if (!match) continue;
    const depth = match[1]!.length / 4;
    stack.length = depth;
    stack.push(match[2]!);
    if (match[3]) routes.push(...match[3].split(', ').map(method => `${method} ${stack.join('')}`));
  }
  return routes;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(server => server.close()));
  await Promise.all(archives.splice(0).map(archive => archive.close().catch(() => undefined)));
  await Promise.all(databases.splice(0).map(drop => drop()));
});

describe('HTTP surface of the conversation server', () => {
  // Verification: Prova degli esiti pubblici dell'API HTTP
  // Verification: Prova del limite dei corpi HTTP
  it('declares statuses from the actual outcome and answers every error with a Problem Details', async () => {
    const { server, events } = await composed();
    server.post<{ Body: string }>('/test-body', async request => ({ length: request.body.length }));
    const list = await server.inject({ method: 'GET', url: '/api/v1/conversations' });
    expect(list.statusCode).toBe(200);
    expect(list.headers['content-type']).toMatch(/^application\/json/);
    expect(list.json()).toEqual({ items: [{ id: conversationId, lastActivityAt: '1970-01-01T00:00:00.100Z' }],
      nextCursor: null });
    const history = await server.inject({ method: 'GET', url: `/api/v1/conversations/${conversationId}` });
    expect(history.statusCode).toBe(200);
    expect(history.headers['content-type']).toMatch(/^application\/json/);

    // The problems do not follow the configured language (Italian here).
    expectProblem(await server.inject({ method: 'GET', url: '/api/v1/conversations/missing' }), 404,
      problems.conversationNotFound);
    expectProblem(await server.inject({ method: 'GET', url: '/api/v1/conversations?limit=0' }), 400,
      problems.invalidPagination);
    const unknownField = expectProblem(await server.inject({ method: 'GET',
      url: '/api/v1/conversations?unexpected=1' }), 400, problems.requestValidation);
    expect(unknownField.errors).toEqual([{ location: 'query', pointer: '/unexpected', code: 'unknown-field',
      detail: 'The field is not allowed.' }]);
    const repeated = expectProblem(await server.inject({ method: 'GET',
      url: '/api/v1/conversations?limit=1&limit=2' }), 400, problems.requestValidation);
    expect(repeated.errors).toEqual([{ location: 'query', pointer: '/limit', code: 'invalid-value',
      detail: 'The value is not valid.' }]);
    const empty = expectProblem(await server.inject({ method: 'GET', url: '/api/v1/conversations/' }), 400,
      problems.requestValidation);
    expect(empty.errors).toEqual([{ location: 'path', pointer: '/conversationId', code: 'invalid-value',
      detail: 'The value is not valid.' }]);

    // A body never changes the answer of a route that expects none, whatever its size, type or syntax.
    const bodies = [
      { headers: { 'content-type': 'application/json' }, payload: '{"text":' },
      { headers: { 'content-type': 'application/json' }, payload: `"${'x'.repeat(1_100_000)}"` },
      { headers: { 'content-type': 'application/x-private' }, payload: 'x' },
    ];
    for (const url of ['/api/v1/conversations', `/api/v1/conversations/${conversationId}`]) {
      const plain = await server.inject({ method: 'GET', url });
      for (const body of bodies) {
        const withBody = await server.inject({ method: 'GET', url, ...body });
        expect(withBody.statusCode, url).toBe(200);
        expect(withBody.body).toBe(plain.body);
      }
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        for (const body of [{}, ...bodies]) {
          const notAllowed = await server.inject({ method, url, ...body });
          expectProblem(notAllowed, 405, problems.methodNotAllowed);
          expect(notAllowed.headers.allow).toBe('GET, HEAD');
        }
      }
    }
    // The body problems of the technical factory, on a test route that accepts a body.
    expectProblem(await server.inject({ method: 'POST', url: '/test-body',
      headers: { 'content-type': 'application/json' }, payload: '{"text":' }), 400, problems.malformedJson);
    expectProblem(await server.inject({ method: 'POST', url: '/test-body',
      headers: { 'content-type': 'application/json' }, payload: '' }), 400, problems.malformedJson);
    expectProblem(await server.inject({ method: 'POST', url: '/test-body',
      headers: { 'content-type': 'application/json' }, payload: `"${'x'.repeat(1_048_576)}"` }), 413,
    problems.contentTooLarge);
    expectProblem(await server.inject({ method: 'POST', url: '/test-body',
      headers: { 'content-type': 'application/x-private' }, payload: 'x' }), 415, problems.unsupportedMediaType);
    const accepted = await server.inject({ method: 'POST', url: '/test-body',
      headers: { 'content-type': 'application/json' }, payload: `"${'x'.repeat(1_048_574)}"` });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ length: 1_048_574 });
    for (const url of ['/api/v1/unknown', '/unknown', '/api/v2/conversations']) {
      expectProblem(await server.inject({ method: 'GET', url }), 404, problems.notFound);
    }
    // A path parameter longer than the router accepts is a resource that does not exist; 100 characters still reach
    // the route.
    expectProblem(await server.inject({ method: 'GET', url: `/api/v1/conversations/${'a'.repeat(100)}` }), 404,
      problems.conversationNotFound);
    const tooLong = expectProblem(await server.inject({ method: 'GET', url: `/api/v1/conversations/${'a'.repeat(101)}` }),
      404, problems.notFound);
    expect(tooLong).toEqual({ type: 'about:blank', title: 'Not Found', status: 404 });
    // A request target that is not a valid URL.
    const badTarget = expectProblem(await server.inject({ method: 'GET', url: '/api/v1/conversations/%zz' }), 400,
      problems.badRequest);
    expect(badTarget).toEqual({ type: 'about:blank', title: 'Bad Request', status: 400 });
    // None of these outcomes is an unexpected failure.
    expect(events).toEqual([]);
  });

  // Verification: Prova del limite dei corpi HTTP
  it('limits the received body to 1 MiB, also when it arrives in parts without Content-Length', async () => {
    const { server } = await composed();
    const reached: number[] = [];
    server.post<{ Body: string }>('/test-body', async request => {
      reached.push(request.body.length);
      return { length: request.body.length };
    });
    expect(HTTP_BODY_LIMIT_BYTES).toBe(1_048_576);
    await server.listen({ host: '127.0.0.1', port: 0 });
    const { port } = server.server.address() as AddressInfo;
    /** Send `size` bytes of a JSON string in parts of 64 KiB, with chunked transfer encoding. */
    const chunked = (path: string, size: number) => new Promise<{ status: number; body: string }>((resolve, reject) => {
      const sent = httpRequest({ host: '127.0.0.1', port, path, method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' } }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
      });
      sent.on('error', reject);
      const payload = Buffer.from(`"${'x'.repeat(size - 2)}"`);
      for (let at = 0; at < payload.length; at += 65_536) sent.write(payload.subarray(at, at + 65_536));
      sent.end();
    });
    expect(await chunked('/test-body', HTTP_BODY_LIMIT_BYTES)).toMatchObject({ status: 200 });
    const over = await chunked('/test-body', HTTP_BODY_LIMIT_BYTES + 1);
    expect(over.status).toBe(413);
    expect(JSON.parse(over.body)).toEqual({ type: 'about:blank', title: 'Content Too Large', status: 413 });
    expect(reached).toEqual([HTTP_BODY_LIMIT_BYTES - 2]);
    const mcp = await chunked('/mcp/memory', HTTP_BODY_LIMIT_BYTES + 1);
    expect(mcp.status).toBe(413);
    expect(JSON.parse(mcp.body)).toEqual({ type: 'about:blank', title: 'Content Too Large', status: 413 });
  });

  // Verification: Prova degli esiti pubblici dell'API HTTP
  it('answers an unexpected fault with the opaque 500 only, and logs it once', async () => {
    const { server, prepared, events } = await composed();
    await prepared.archive.db.destroy();
    for (const url of ['/api/v1/conversations', `/api/v1/conversations/${conversationId}`]) {
      const response = await server.inject({ method: 'GET', url });
      const body = expectProblem(response, 500, problems.internalServerError);
      expect(body).toEqual({ type: 'about:blank', title: 'Internal Server Error', status: 500 });
      expect(response.body).not.toMatch(/destroy|sqlite|postgres|kysely|pool|stack/i);
    }
    expect(events.map(event => [event.level, event.fields.event]))
      .toEqual([['error', 'http.unexpected_failure'], ['error', 'http.unexpected_failure']]);
  });

  // Verification: Prova degli esiti pubblici dell'API HTTP
  it('rejects the opening of the session with the catalog problems', async () => {
    const { server } = await composed();
    await server.listen({ host: '127.0.0.1', port: 0 });
    const { port } = server.server.address() as AddressInfo;
    expectProblem(await rejectedUpgrade(port, 'ambrogio.v1', 'https://other.test'), 403, problems.originNotAllowed);
    expectProblem(await rejectedUpgrade(port, 'ambrogio.v2'), 400, problems.unsupportedSubprotocol);
  });

  // Verification: Prova della struttura della superficie HTTP
  it('registers only the routes of its aggregators, versioned except the session', async () => {
    const { server } = await composed();
    await server.ready();
    const write = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
    const expected: Array<readonly [string, string]> = [
      ...['GET', 'HEAD', ...write].map(method => [method, '/api/v1/conversations'] as const),
      ...['GET', 'HEAD', ...write].map(method => [method, '/api/v1/conversations/:conversationId'] as const),
      ['GET', '/api/session'], ['HEAD', '/api/session'],
      // The MCP server of the memory, outside the HTTP API: POST, and the refused session methods.
      ...['GET', 'HEAD', 'POST', 'DELETE'].map(method => [method, '/mcp/memory'] as const),
      // The liveness endpoint and the CORS preflight of the technical factory.
      ['GET', '/health'], ['HEAD', '/health'],
      ['OPTIONS', '*'],
    ];
    for (const [method, url] of expected.filter(([, url]) => url !== '*')) {
      expect(server.hasRoute({ method: method as 'GET', url }), `${method} ${url}`).toBe(true);
    }
    const routes = registeredRoutes(server);
    expect(routes.sort()).toEqual(expected.map(([method, url]) => `${method} ${url}`).sort());
    for (const route of routes) {
      const url = route.split(' ')[1]!;
      expect(url.startsWith('/api/v1/') || ['/api/session', '/mcp/memory', '/health', '*'].includes(url), route)
        .toBe(true);
    }

    // No previous API is kept: paths without a version are routes that do not exist.
    for (const url of ['/api/conversations', `/api/conversations/${conversationId}`, '/api/conversations?limit=1']) {
      expect((await server.inject({ method: 'GET', url: `/api/v1${url.slice(4)}` })).statusCode).toBe(200);
      expectProblem(await server.inject({ method: 'GET', url }), 404, problems.notFound);
    }
  });

  // Verification: Prova della struttura della superficie HTTP
  it('keeps the schemas and the route adapter that invokes the use case in distinct files of every slice', async () => {
    const root = fileURLToPath(new URL('../../../../packages/conversations/src/adapters/in/http/', import.meta.url));
    const slices = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory())
      .map(entry => entry.name).sort();
    expect(slices).toEqual(['get-conversation', 'list-conversations']);
    for (const slice of slices) {
      const files = (await readdir(join(root, slice))).filter(name => !name.endsWith('.spec.ts')).sort();
      expect(files, slice).toEqual([`${slice}.route.adapter.ts`, `${slice}.schemas.ts`]);
    }
  });
});
