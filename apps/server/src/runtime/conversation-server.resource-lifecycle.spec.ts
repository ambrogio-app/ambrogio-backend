import { writeConfigFile } from '../../test/support/config-fixture.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { startConversationServer } from './conversation-server.js';
import { closeAllClients, ProtocolClient, takeSchemaViolations } from '../../test/support/protocol-client.js';

const resource = vi.hoisted(() => ({ opened: 0, closed: 0 }));
vi.mock('@ambrogio/conversations/adapters/out/sqlite/archive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ambrogio/conversations/adapters/out/sqlite/archive')>();
  return { ...actual, async openConversationArchive(
    ...args: Parameters<typeof actual.openConversationArchive>
  ) {
    const archive = await actual.openConversationArchive(...args);
    resource.opened++;
    return { ...archive, async close() {
      resource.closed++;
      await archive.close();
    } };
  } };
});

const directories: string[] = [];
afterEach(async () => {
  await closeAllClients();
  expect(takeSchemaViolations()).toEqual([]);
  resource.opened = 0;
  resource.closed = 0;
  await Promise.all(directories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })));
});

async function fixture(port: number) {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-resource-lifecycle-'));
  directories.push(directory);
  const http = join(directory, 'http.ts');
  const conversations = join(directory, 'conversations.ts');
  await writeConfigFile(http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeConfigFile(conversations, JSON.stringify({ archivePath: join(directory, 'archive.sqlite') }));
  return { directory, environment: { AMBROGIO_HTTP_CONFIG_PATH: http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations } };
}

async function listeningServer() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  return { server, port: address.port };
}

test.each(['answer', 'agent failure'] as const)(
  'closes the archive once after %s and server shutdown', async scenario => {
    const reservation = await listeningServer();
    const port = reservation.port;
    await new Promise<void>(resolve => reservation.server.close(() => resolve()));
    const files = await fixture(port);
    let agentClosed = 0;
    const runtime = await startConversationServer(files.environment, files.directory,
      async () => ({ orchestrator: { async *produce() {
        if (scenario === 'agent failure') throw new Error('controlled agent failure');
        yield { kind: 'text' as const, text: 'answer' };
        yield { kind: 'reply_expectation' as const, expectsReply: false };
      } }, async close() { agentClosed++; } }));
    try {
      expect(resource).toEqual({ opened: 1, closed: 0 });
      const client = await ProtocolClient.ready(`ws://127.0.0.1:${port}/api/session`);
      const result = await client.textTurn('question');
      expect(result.final.type).toBe(scenario === 'answer' ? 'turn.completed' : 'turn.failed');
      expect(resource.closed).toBe(0);
    } finally { await runtime.close(); }
    await runtime.close();
    expect(resource).toEqual({ opened: 1, closed: 1 });
    expect(agentClosed).toBe(1);
  },
);

test('closes the prepared archive once when the listener cannot start', async () => {
  const reservation = await listeningServer();
  const files = await fixture(reservation.port);
  let agentClosed = 0;
  try {
    await expect(startConversationServer(files.environment, files.directory,
      async () => ({ orchestrator: { async *produce() { yield { kind: 'text' as const, text: 'unused' }; } },
        async close() { agentClosed++; } }))).rejects.toThrow();
    expect(resource).toEqual({ opened: 1, closed: 1 });
    expect(agentClosed).toBe(1);
  } finally {
    await new Promise<void>(resolve => reservation.server.close(() => resolve()));
  }
});
