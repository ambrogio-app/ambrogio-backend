import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { startTestServer, type TestServer } from './test-server.js';
import { closeAllClients, pcm, ProtocolClient, takeSchemaViolations } from '../../test/support/protocol-client.js';
import { echoReply, fakeSpeech } from '../../test/support/session-fixture.js';

const directories: string[] = [];
const servers: TestServer[] = [];
afterEach(async () => {
  await closeAllClients();
  await Promise.all(servers.splice(0).map(server => server.close()));
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
  expect(takeSchemaViolations()).toEqual([]);
});

async function start(options: Readonly<{ voice?: boolean; allowedOrigins?: readonly string[] }> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-test-server-'));
  directories.push(directory);
  const server = await startTestServer({ directory, language: 'it', reply: echoReply().reply,
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

  const list = await fetch(`${server.origin}/api/conversations`);
  expect(list.status).toBe(200);
  const body = await list.json() as { items: readonly Readonly<{ id: string }>[] };
  expect(body.items).toHaveLength(1);
  const history = await fetch(`${server.origin}/api/conversations/${body.items[0]!.id}`);
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
  const allowed = await fetch(`${server.origin}/api/conversations`, { headers: { origin: 'http://chat.example' } });
  expect(allowed.headers.get('access-control-allow-origin')).toBe('http://chat.example');
  const other = await fetch(`${server.origin}/api/conversations`, { headers: { origin: 'http://other.example' } });
  expect(other.headers.get('access-control-allow-origin')).toBeNull();
});

test('closes idempotently and stops listening', async () => {
  const server = await start();
  await Promise.all([server.close(), server.close()]);
  await expect(fetch(`${server.origin}/api/conversations`)).rejects.toThrow();
});
