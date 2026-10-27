import { afterEach, expect, test, vi } from 'vitest';
import { startTestServer, type TestServer } from './test-server.js';
import { closeAllClients, pcm, ProtocolClient, takeSchemaViolations } from '../../test/support/protocol-client.js';
import { echoReply, fakeSpeech } from '../../test/support/session-fixture.js';
import { testDatabaseNames, testDatabaseServer } from '../../../../test/support/test-database.js';

/** The databases the test entry creates, recorded without changing what it does. */
const created = vi.hoisted(() => [] as string[]);
vi.mock('@ambrogio/conversations/adapters/out/postgres/temporary-database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ambrogio/conversations/adapters/out/postgres/temporary-database')>();
  return { ...actual, async createTemporaryDatabase(serverUrl: string) {
    const database = await actual.createTemporaryDatabase(serverUrl);
    created.push(new URL(database.url).pathname.slice(1));
    return database;
  } };
});

const servers: TestServer[] = [];
afterEach(async () => {
  await closeAllClients();
  await Promise.all(servers.splice(0).map(server => server.close()));
  created.length = 0;
  expect(takeSchemaViolations()).toEqual([]);
});

async function start(options: Readonly<{ voice?: boolean; allowedOrigins?: readonly string[] }> = {}) {
  const server = await startTestServer({ databaseUrl: testDatabaseServer(), language: 'it', reply: echoReply().reply,
    ...(options.voice ? { speech: fakeSpeech().factory } : {}),
    ...(options.allowedOrigins ? { allowedOrigins: options.allowedOrigins } : {}) });
  servers.push(server);
  return server;
}

test('serves the session and the HTTP routes of the product on a free loopback port', async () => {
  const server = await start();
  expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(server.sessionUrl.href).toBe(`${server.origin.replace('http:', 'ws:')}/api/session`);

  const client = await ProtocolClient.ready(server.sessionUrl.href);
  const result = await client.textTurn('ciao');
  expect(result.final).toMatchObject({ type: 'turn.completed', expectsReply: false });
  expect(result.outputs.map(output => output.text).join('')).toBe('eco: ciao');

  const list = await fetch(`${server.origin}/api/v1/conversations`);
  expect(list.status).toBe(200);
  const body = await list.json() as { items: readonly Readonly<{ id: string }>[] };
  expect(body.items).toHaveLength(1);
  const history = await fetch(`${server.origin}/api/v1/conversations/${body.items[0]!.id}`);
  expect(history.status).toBe(200);
});

test('accepts voice turns only with the deterministic speech components of the caller', async () => {
  const voiced = await start({ voice: true });
  const client = await ProtocolClient.ready(voiced.sessionUrl.href);
  const result = await client.audioTurn(pcm('buongiorno'), { reply: 'audio' });
  expect(result.final).toMatchObject({ type: 'turn.completed' });
  expect(result.outputs.map(output => output.audio.toString('utf8')).join('')).toBe('eco: buongiorno');

  const silent = await start();
  const textOnly = await ProtocolClient.ready(silent.sessionUrl.href);
  const rejected = await textOnly.audioTurn(pcm('buongiorno'));
  expect(rejected.final).toMatchObject({ type: 'turn.rejected', reason: 'audio_unavailable' });
});

test('applies the allowed origins of the caller to the session and the HTTP routes', async () => {
  const server = await start({ allowedOrigins: ['http://chat.example'] });
  const allowed = await fetch(`${server.origin}/api/v1/conversations`, { headers: { origin: 'http://chat.example' } });
  expect(allowed.headers.get('access-control-allow-origin')).toBe('http://chat.example');
  const other = await fetch(`${server.origin}/api/v1/conversations`, { headers: { origin: 'http://other.example' } });
  expect(other.headers.get('access-control-allow-origin')).toBeNull();
});

test('closes idempotently and stops listening', async () => {
  const server = await start();
  await Promise.all([server.close(), server.close()]);
  await expect(fetch(`${server.origin}/api/v1/conversations`)).rejects.toThrow();
});

// Verification: Prova dell'ingresso di prova del server conversazionale
test('keeps the archive in one new test database while running and drops it at closing', async () => {
  const server = await start();
  expect(created).toHaveLength(1);
  const [name] = created;
  expect(name).toMatch(/^ambrogio_test_[0-9a-f]{16}$/);
  expect(await testDatabaseNames()).toContain(name);
  const client = await ProtocolClient.ready(server.sessionUrl.href);
  expect((await client.textTurn('ciao')).final.type).toBe('turn.completed');
  await client.close();
  await server.close();
  expect(await testDatabaseNames()).not.toContain(name);
});

// Verification: Prova dell'ingresso di prova del server conversazionale
test('drops its database when the start fails after creating it', async () => {
  // A language the configuration refuses: the start fails after the database is created.
  await expect(startTestServer({ databaseUrl: testDatabaseServer(), language: 'fr' as 'it', reply: echoReply().reply }))
    .rejects.toThrow('Invalid environment variable AMBROGIO_LANGUAGE');
  expect(created).toHaveLength(1);
  expect(await testDatabaseNames()).not.toContain(created[0]);
});
