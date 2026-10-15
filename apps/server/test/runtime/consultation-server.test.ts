import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/sqlite/archive';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { prepareConfiguredConversations } from '../../src/composition/conversations.js';
import { buildConsultationServer, startConsultationServer } from '../../src/runtime/consultation-server.js';
import { loadHttpConfig, type HttpConfig } from '../../src/runtime/http-config.js';

const directories: string[] = [];
const base: HttpConfig = { host: '127.0.0.1', port: 3000, allowedOrigins: [], publicHttps: false };

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-http-'));
  directories.push(directory);
  return { http: join(directory, 'http.json'), conversations: join(directory, 'conversations.json'),
    archive: join(directory, 'archive.sqlite') };
}

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return address.port;
}

async function expectPortAvailable(port: number): Promise<void> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>(resolve => probe.close(() => resolve()));
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('consultation HTTP runtime', () => {
  it('requires explicit host and port and validates CORS and HSTS settings', async () => {
    const files = await fixture();
    await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port: 3030 }));
    expect(await loadHttpConfig(files.http)).toEqual({ ...base, port: 3030 });
    for (const invalid of [
      {}, { port: 3030 }, { host: '127.0.0.1' }, { host: '', port: 3030 },
      { host: '127.0.0.1', port: 0 }, { host: '127.0.0.1', port: 65536 },
      { host: '127.0.0.1', port: '3030' }, { ...base, allowedOrigins: ['*'] },
      { ...base, allowedOrigins: ['https://example.test/path'] },
      { ...base, publicHttps: true }, { ...base, publicHttps: true, hstsMaxAgeSeconds: 0 },
    ]) {
      await writeFile(files.http, JSON.stringify(invalid));
      await expect(loadHttpConfig(files.http)).rejects.toThrow();
    }
    await writeFile(files.http, '{');
    await expect(loadHttpConfig(files.http)).rejects.toThrow('Invalid HTTP configuration file');
    await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port: 3030 }));
    await writeFile(files.conversations, '{}');
    await expect(startConsultationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }))
      .rejects.toThrow('Missing conversation archive path');
  });

  it('does not open a listener when the HTTP path, file or listener fields are invalid', async () => {
    const files = await fixture();
    const port = await freePort();
    await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
    const environment = { AMBROGIO_HTTP_CONFIG_PATH: files.http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations, PORT: String(port), HOST: '0.0.0.0' };
    await expect(startConsultationServer({ AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }))
      .rejects.toThrow('Missing HTTP configuration path');
    await expect(startConsultationServer(environment)).rejects.toThrow('Invalid HTTP configuration file');
    await writeFile(files.http, '{');
    await expect(startConsultationServer(environment)).rejects.toThrow('Invalid HTTP configuration file');
    for (const invalid of [{ port }, { host: '127.0.0.1' },
      { host: '127.0.0.1', port: 0 }, { host: '127.0.0.1', port: '3000' }]) {
      await writeFile(files.http, JSON.stringify(invalid));
      await expect(startConsultationServer(environment)).rejects.toThrow('Invalid HTTP listener configuration');
      await expectPortAvailable(port);
    }
    await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
    await writeFile(files.conversations, JSON.stringify({ archivePath:
      join(dirname(files.archive), 'missing', 'archive.sqlite') }));
    await expect(startConsultationServer(environment)).rejects.toThrow();
    await expectPortAvailable(port);
  });

  it('applies global security headers, exact CORS origins and distinct request IDs', async () => {
    const files = await fixture();
    const prepared = await prepareConfiguredConversations({ archivePath: files.archive,
      listPageSize: 20, maxListPageSize: 100, language: 'en' }, new Date());
    const server = await buildConsultationServer({ ...base, allowedOrigins: ['https://client.test'],
      publicHttps: true, hstsMaxAgeSeconds: 600 }, prepared);
    server.get('/test-fallback', async () => { throw new Error('private diagnostic marker'); });
    try {
      const allowed = await server.inject({ method: 'GET', url: '/api/conversations',
        headers: { origin: 'https://client.test', 'request-id': 'client-controlled' } });
      const rejected = await server.inject({ method: 'GET', url: '/api/conversations',
        headers: { origin: 'https://other.test' } });
      const missing = await server.inject({ method: 'GET', url: '/missing' });
      const invalid = await server.inject({ method: 'GET', url: '/api/conversations?limit=0',
        headers: { 'x-forwarded-proto': 'http' } });
      const failed = await server.inject({ method: 'GET', url: '/api/conversations/not-found',
        headers: { 'x-forwarded-proto': 'http' } });
      const fallback = await server.inject({ method: 'GET', url: '/test-fallback',
        headers: { 'x-forwarded-proto': 'http' } });
      expect(allowed.statusCode).toBe(200);
      expect(allowed.headers['access-control-allow-origin']).toBe('https://client.test');
      expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
      expect(invalid.statusCode).toBe(400);
      expect(failed.statusCode).toBe(404);
      expect(fallback.statusCode).toBe(500);
      expect(fallback.json()).toEqual({ error: 'Internal server error.' });
      for (const response of [allowed, invalid, failed, missing, fallback]) {
        expect(response.headers['strict-transport-security']).toBe('max-age=600');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      }
      const ids = [allowed, rejected, missing, invalid, failed, fallback]
        .map(response => response.headers['x-request-id']);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const preflight = await server.inject({ method: 'OPTIONS', url: '/api/conversations',
        headers: { origin: 'https://client.test', 'access-control-request-method': 'GET' } });
      expect(preflight.headers['access-control-allow-origin']).toBe('https://client.test');
      const rejectedPreflight = await server.inject({ method: 'OPTIONS', url: '/api/conversations',
        headers: { origin: 'https://other.test', 'access-control-request-method': 'GET' } });
      expect(rejectedPreflight.headers['access-control-allow-origin']).toBeUndefined();
      for (const response of [rejected, rejectedPreflight]) {
        expect(response.headers['access-control-allow-credentials']).toBeUndefined();
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    } finally {
      await server.close();
      await prepared.archive.close();
    }

    const other = await prepareConfiguredConversations({ archivePath: files.archive,
      listPageSize: 20, maxListPageSize: 100, language: 'en' }, new Date());
    const defaultServer = await buildConsultationServer(base, other);
    try {
      const response = await defaultServer.inject({ method: 'GET', url: '/api/conversations',
        headers: { origin: 'https://client.test', 'x-forwarded-proto': 'https' } });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['strict-transport-security']).toBeUndefined();
      const failed = await defaultServer.inject({ method: 'GET', url: '/api/conversations?limit=0',
        headers: { 'x-forwarded-proto': 'https' } });
      expect(failed.statusCode).toBe(400);
      expect(failed.headers['strict-transport-security']).toBeUndefined();
      const preflight = await defaultServer.inject({ method: 'OPTIONS', url: '/api/conversations',
        headers: { origin: 'https://client.test', 'access-control-request-method': 'GET' } });
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
      expect(preflight.headers['strict-transport-security']).toBeUndefined();
    } finally {
      await defaultServer.close();
      await other.archive.close();
    }
  });

  it('correlates diagnostic events and error responses for both consultation routes', async () => {
    const files = await fixture();
    const prepared = await prepareConfiguredConversations({ archivePath: files.archive,
      listPageSize: 20, maxListPageSize: 100, language: 'en' }, new Date());
    const output: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      output.push(String(chunk));
      return true;
    });
    const errorOutput: string[] = [];
    const writeError = vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      errorOutput.push(String(chunk));
      return true;
    });
    const server = await buildConsultationServer(base, prepared);
    server.get('/test-fallback', async () => { throw new Error('private diagnostic marker'); });
    const diagnostics = new Map<string, { binding: unknown; events: unknown[][] }>();
    server.addHook('onRequest', (request, _reply, done) => {
      const error = vi.spyOn(request.log, 'error');
      diagnostics.set(request.id, { binding: request.log.bindings(), events: error.mock.calls });
      done();
    });
    try {
      const ordinary = await server.inject({ method: 'GET', url: '/api/conversations',
        headers: { authorization: 'private authorization marker' } });
      const expected = await server.inject({ method: 'GET', url: '/api/conversations?limit=0' });
      const missing = await server.inject({ method: 'GET', url: '/api/conversations/private-id-marker' });
      expect([ordinary.statusCode, expected.statusCode, missing.statusCode]).toEqual([200, 400, 404]);
      expect(output).toEqual([]);
      await prepared.archive.close();
      const list = await server.inject({ method: 'GET', url: '/api/conversations' });
      const history = await server.inject({ method: 'GET', url: '/api/conversations/example' });
      const fallback = await server.inject({ method: 'GET', url: '/test-fallback' });
      for (const response of [list, history, fallback]) {
        expect(response.statusCode).toBe(500);
        expect(response.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      }
      expect(list.headers['cache-control']).toBe('no-store');
      expect(history.headers['cache-control']).toBe('no-store');
      expect(list.headers['x-request-id']).not.toBe(history.headers['x-request-id']);
      for (const [response, event] of [[list, 'conversation_list_http_failed'],
        [history, 'conversation_history_http_failed'], [fallback, 'http.unexpected_failure']] as const) {
        const id = response.headers['x-request-id'] as string;
        const diagnostic = diagnostics.get(id);
        expect(diagnostic?.binding).toMatchObject({ correlationId: id });
        expect(diagnostic?.events[0]?.[0]).toMatchObject({ event });
        expect(diagnostic?.events[0]?.[1]).toBe('HTTP request failed');
      }
      const rows = output.flatMap(chunk => chunk.split('\n')).filter(line => line.length > 0)
        .map(line => JSON.parse(line) as { event?: string; correlationId?: string; msg?: string });
      expect(rows).toHaveLength(3);
      expect(errorOutput).toEqual([]);
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual([
          'correlationId', 'err', 'event', 'hostname', 'level', 'msg', 'pid', 'time',
        ]);
      }
      expect(rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: 'conversation_list_http_failed',
          correlationId: list.headers['x-request-id'], msg: 'HTTP request failed' }),
        expect.objectContaining({ event: 'conversation_history_http_failed',
          correlationId: history.headers['x-request-id'], msg: 'HTTP request failed' }),
        expect.objectContaining({ event: 'http.unexpected_failure',
          correlationId: fallback.headers['x-request-id'], msg: 'HTTP request failed' }),
      ]));
      expect(output.join('')).not.toContain('private diagnostic marker');
      expect(output.join('')).not.toContain('driver has already been destroyed');
      expect(output.join('')).not.toContain('private authorization marker');
      expect(output.join('')).not.toContain('private-id-marker');
    } finally {
      write.mockRestore();
      writeError.mockRestore();
      await server.close();
    }
  });

  it('normalizes errors at the generic HTTP fallback', async () => {
    const files = await fixture();
    const prepared = await prepareConfiguredConversations({ archivePath: files.archive,
      listPageSize: 20, maxListPageSize: 100, language: 'en' }, new Date());
    const cause = new Error('private cause');
    const original = new TypeError('private bug', { cause });
    original.name = 'ExternalDriverError';
    Object.assign(original, { connectionString: 'private driver property' });
    const sdkError = new Error('private SDK failure');
    Object.assign(sdkError, { token: 'private SDK property' });
    const project = new ProjectError('project diagnostic marker', { cause });
    const unknown = { marker: 'private unknown failure' };
    const originalProperties = Object.getOwnPropertyDescriptors(original);
    const sdkProperties = Object.getOwnPropertyDescriptors(sdkError);
    const causeProperties = Object.getOwnPropertyDescriptors(cause);
    const projectProperties = Object.getOwnPropertyDescriptors(project);
    const output: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      output.push(String(chunk));
      return true;
    });
    const server = await buildConsultationServer(base, prepared);
    const logged: { err: Error; event: string }[] = [];
    server.get('/test-project', async () => { throw project; });
    server.get('/test-fallback', async () => { throw original; });
    server.get('/test-sdk', async () => { throw sdkError; });
    server.get('/test-unknown', async () => { throw unknown; });
    server.get('/test-string', async () => { throw 'another private failure'; });
    server.addHook('onRequest', (request, _reply, done) => {
      const logError = request.log.error.bind(request.log);
      const error = vi.spyOn(request.log, 'error');
      error.mockImplementation((value: unknown, message?: string) => {
        logged.push(value as { err: Error; event: string });
        logError(value, message);
      });
      done();
    });
    try {
      for (const url of ['/test-project', '/test-fallback', '/test-sdk', '/test-unknown', '/test-string']) {
        const response = await server.inject({ method: 'GET', url });
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({ error: 'Internal server error.' });
      }
      expect(logged.map(item => item.event)).toEqual([
        'http.unexpected_failure', 'http.unexpected_failure',
        'http.unexpected_failure', 'http.unexpected_failure', 'http.unexpected_failure',
      ]);
      expect(logged[0]!.err).toBe(project);
      expect(logged[1]!.err).toBe(original);
      expect(logged[2]!.err).toBe(sdkError);
      expect(original.cause).toBe(cause);
      expect(logged[3]!.err).toBeInstanceOf(Error);
      expect(logged[3]!.err.cause).toBe(unknown);
      expect(logged[4]!.err.cause).toBe('another private failure');
      expect(logged[3]!.err.message).toBe(logged[4]!.err.message);
      expect(Object.getOwnPropertyDescriptors(project)).toEqual(projectProperties);
      expect(Object.getOwnPropertyDescriptors(original)).toEqual(originalProperties);
      expect(Object.getOwnPropertyDescriptors(sdkError)).toEqual(sdkProperties);
      expect(Object.getOwnPropertyDescriptors(cause)).toEqual(causeProperties);
      expect(unknown).toEqual({ marker: 'private unknown failure' });
      const rows = output.flatMap(chunk => chunk.split('\n')).filter(Boolean)
        .map(line => JSON.parse(line) as { err: Record<string, unknown> });
      expect(rows).toHaveLength(5);
      expect(rows[0]!.err).toEqual({ type: 'ProjectError', message: project.message, stack: project.stack });
      for (const row of rows.slice(1)) {
        expect(row.err).toEqual({ type: 'Error', message: 'Unexpected HTTP failure', stack: '[redacted]' });
      }
      expect(output.join('')).not.toMatch(/private bug|private cause|private driver property|private SDK failure|private SDK property|private unknown failure|another private failure/);
    } finally {
      write.mockRestore();
      await server.close();
      await prepared.archive.close();
    }
  });

  it('listens on the configured address, recovers pending turns and exposes only the two GETs', async () => {
    const files = await fixture();
    const archive = await openConversationArchive(files.archive, new Date(1000));
    await archive.db.insertInto('conversations').values({ id: 'conversation', created_at: 100,
      last_activity_at: 100 }).execute();
    await archive.db.insertInto('turns').values({ id: 'turn', conversation_id: 'conversation',
      ordinal: 1, text: 'hello', accepted_at: 100, status: 'pending', answer: null,
      error: null, finished_at: null }).execute();
    await archive.db.updateTable('installation').set({ active_turn_id: 'turn' }).where('id', '=', 1).execute();
    await archive.close();
    const destroy = vi.spyOn(Object.getPrototypeOf(archive.db) as { destroy: () => Promise<void> }, 'destroy');

    const port = await freePort();
    await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
    await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
    const runtime = await startConsultationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations });
    const address = runtime.server.server.address();
    expect(address && typeof address !== 'string' && address.address).toBe('127.0.0.1');
    expect(address && typeof address !== 'string' && address.port).toBe(port);
    try {
      const origin = `http://127.0.0.1:${port}`;
      const list = await fetch(`${origin}/api/conversations`);
      expect(list.status).toBe(200);
      expect((await list.json() as { items: { id: string }[] }).items).toEqual([
        { id: 'conversation', lastActivityAt: new Date(100).toISOString() },
      ]);
      const history = await fetch(`${origin}/api/conversations/conversation`);
      expect(history.status).toBe(200);
      expect((await history.json() as { turns: { status: string }[] }).turns[0]?.status).toBe('interrupted');
      expect((await fetch(`${origin}/api/conversations/turns`, { method: 'POST' })).status).toBe(404);
    } finally {
      await runtime.close();
      expect(destroy).toHaveBeenCalledTimes(1);
      destroy.mockRestore();
      expect(runtime.server.server.listening).toBe(false);
      await expectPortAvailable(port);
    }
  });
});
