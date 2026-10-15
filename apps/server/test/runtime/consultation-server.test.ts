import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/sqlite/archive';
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

  it('applies global security headers, exact CORS origins and distinct request IDs', async () => {
    const files = await fixture();
    const prepared = await prepareConfiguredConversations({ archivePath: files.archive,
      listPageSize: 20, maxListPageSize: 100, language: 'en' }, new Date());
    const server = await buildConsultationServer({ ...base, allowedOrigins: ['https://client.test'],
      publicHttps: true, hstsMaxAgeSeconds: 600 }, prepared);
    try {
      const allowed = await server.inject({ method: 'GET', url: '/api/conversations',
        headers: { origin: 'https://client.test', 'request-id': 'client-controlled' } });
      const rejected = await server.inject({ method: 'GET', url: '/api/conversations',
        headers: { origin: 'https://other.test' } });
      const missing = await server.inject({ method: 'GET', url: '/missing' });
      expect(allowed.statusCode).toBe(200);
      expect(allowed.headers['access-control-allow-origin']).toBe('https://client.test');
      expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
      expect(allowed.headers['strict-transport-security']).toBe('max-age=600');
      expect(missing.headers['strict-transport-security']).toBe('max-age=600');
      expect(missing.headers['x-content-type-options']).toBe('nosniff');
      const ids = [allowed, rejected, missing].map(response => response.headers['x-request-id']);
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const preflight = await server.inject({ method: 'OPTIONS', url: '/api/conversations',
        headers: { origin: 'https://client.test', 'access-control-request-method': 'GET' } });
      expect(preflight.headers['access-control-allow-origin']).toBe('https://client.test');
    } finally {
      await server.close();
      await prepared.archive.close();
    }

    const other = await prepareConfiguredConversations({ archivePath: files.archive,
      listPageSize: 20, maxListPageSize: 100, language: 'en' }, new Date());
    const defaultServer = await buildConsultationServer(base, other);
    try {
      const response = await defaultServer.inject({ method: 'GET', url: '/api/conversations',
        headers: { origin: 'https://client.test' } });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['strict-transport-security']).toBeUndefined();
    } finally {
      await defaultServer.close();
      await other.archive.close();
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

    const port = await freePort();
    await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
    await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
    const runtime = await startConsultationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations });
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
    }
  });
});
