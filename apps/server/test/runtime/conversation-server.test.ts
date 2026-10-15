import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/sqlite/archive';
import { prepareConfiguredConversations } from '../../src/composition/conversations.js';
import { buildConversationServer } from '../../src/runtime/consultation-server.js';
import { startConversationServer } from '../../src/runtime/conversation-server.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) =>
  rm(path, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-conversation-server-'));
  directories.push(directory);
  return { directory, http: join(directory, 'http.json'),
    conversations: join(directory, 'conversations.json'), archive: join(directory, 'archive.sqlite') };
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

test('POST/SSE uses the orchestrator and retains security, CORS and correlation headers', async () => {
  const files = await fixture();
  const prepared = await prepareConfiguredConversations({ archivePath: files.archive,
    listPageSize: 20, maxListPageSize: 100, language: 'en' }, new Date());
  const { server } = await buildConversationServer({ host: '127.0.0.1', port: 3000,
    allowedOrigins: ['https://client.test'], publicHttps: true, hstsMaxAgeSeconds: 600 },
  prepared, { async *produce() { yield 'Hello'; yield ' world'; } });
  try {
    const preflight = await server.inject({ method: 'OPTIONS', url: '/api/conversations/turns',
      headers: { origin: 'https://client.test', 'access-control-request-method': 'POST' } });
    expect(preflight.headers['access-control-allow-methods']).toContain('POST');
    expect(preflight.headers['access-control-allow-origin']).toBe('https://client.test');
    const rejected = await server.inject({ method: 'OPTIONS', url: '/api/conversations/turns',
      headers: { origin: 'https://other.test', 'access-control-request-method': 'POST' } });
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    const turn = await server.inject({ method: 'POST', url: '/api/conversations/turns',
      headers: { origin: 'https://client.test', 'content-type': 'application/json' },
      payload: { text: 'Hi' } });
    expect(turn.statusCode).toBe(200);
    expect(turn.body).toContain('event: conversation');
    expect(turn.body).toContain('event: delta');
    expect(turn.body).toContain('event: done');
    expect(turn.headers['content-type']).toContain('text/event-stream');
    expect(turn.headers['cache-control']).toBe('no-store');
    expect(turn.headers['strict-transport-security']).toBe('max-age=600');
    expect(turn.headers['x-content-type-options']).toBe('nosniff');
    expect(turn.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const list = await server.inject({ method: 'GET', url: '/api/conversations' });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
  } finally {
    await server.close();
    await prepared.archive.close();
  }
});

test('shutdown interrupts a pending turn without waiting for the remote reply', async () => {
  const files = await fixture();
  const port = await freePort();
  await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
  let started!: () => void;
  const producing = new Promise<void>((resolve) => { started = resolve; });
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  let closed = false;
  const runtime = await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }, files.directory,
  async () => ({ orchestrator: { async *produce() { started(); await wait; yield 'too late'; } },
    async close() { closed = true; } }));
  const origin = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(`${origin}/api/conversations/turns`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Hi' }) });
    expect(response.status).toBe(200);
    await producing;
    await expect(Promise.race([runtime.close(), new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown waited for remote reply')), 1000))])).resolves.toBeUndefined();
    expect(closed).toBe(true);
    release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const archive = await openConversationArchive(files.archive, new Date());
    try {
      expect(archive.recoveredTurns).toBe(0);
      const rows = await archive.db.selectFrom('turns').select(['status', 'answer']).execute();
      expect(rows).toEqual([{ status: 'interrupted', answer: null }]);
    } finally { await archive.close(); }
  } finally {
    release();
    await runtime.close();
  }
});

test('invalid agent files prevent the conversation listener from starting', async () => {
  const files = await fixture();
  const port = await freePort();
  await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
  await writeFile(join(files.directory, 'orchestrator.json'), '{');
  await expect(startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }, files.directory))
    .rejects.toThrow('Invalid agent configuration: orchestrator');
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});
