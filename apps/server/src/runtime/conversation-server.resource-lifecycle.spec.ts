import { serverEnvironment } from '../../test/support/config-fixture.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { startConversationServer } from '../../test/support/start-server.js';
import { recordingLogger } from '../../test/support/logger-fixture.js';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { prepareConversationServer } from './conversation-server.js';
import { LifecycleError } from './lifecycle.js';
import { closeAllClients, ProtocolClient, takeSchemaViolations } from '../../test/support/protocol-client.js';

const resource = vi.hoisted(() => ({ opened: 0, closed: 0, order: [] as string[], closeFailure: undefined as Error | undefined }));
vi.mock('@ambrogio/conversations/adapters/out/sqlite/archive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ambrogio/conversations/adapters/out/sqlite/archive')>();
  return { ...actual, async openConversationArchive(
    ...args: Parameters<typeof actual.openConversationArchive>
  ) {
    const archive = await actual.openConversationArchive(...args);
    resource.opened++;
    return { ...archive, async close() {
      resource.closed++;
      resource.order.push('archive');
      await archive.close();
      if (resource.closeFailure) throw resource.closeFailure;
    } };
  } };
});

const directories: string[] = [];
afterEach(async () => {
  await closeAllClients();
  expect(takeSchemaViolations()).toEqual([]);
  resource.opened = 0;
  resource.closed = 0;
  resource.order.length = 0;
  resource.closeFailure = undefined;
  await Promise.all(directories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })));
});

async function fixture(port: number) {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-resource-lifecycle-'));
  directories.push(directory);
  return { directory, environment: serverEnvironment({ directory, archive: join(directory, 'archive.sqlite') }, port) };
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
    const runtime = await startConversationServer(files.environment,
      async () => ({ orchestrator: { async *produce() {
        if (scenario === 'agent failure') throw new Error('controlled agent failure');
        yield { kind: 'text' as const, text: 'answer' };
        yield { kind: 'reply_expectation' as const, expectsReply: false };
      } }, async close() { agentClosed++; } }));
    try {
      expect(resource).toMatchObject({ opened: 1, closed: 0 });
      const client = await ProtocolClient.ready(`ws://127.0.0.1:${port}/api/session`);
      const result = await client.textTurn('question');
      expect(result.final.type).toBe(scenario === 'answer' ? 'turn.completed' : 'turn.failed');
      expect(resource.closed).toBe(0);
    } finally { await runtime.close(); }
    await runtime.close();
    expect(resource).toMatchObject({ opened: 1, closed: 1 });
    expect(agentClosed).toBe(1);
  },
);

test('closes the prepared archive once when the listener cannot start', async () => {
  const reservation = await listeningServer();
  const files = await fixture(reservation.port);
  let agentClosed = 0;
  try {
    await expect(startConversationServer(files.environment,
      async () => ({ orchestrator: { async *produce() { yield { kind: 'text' as const, text: 'unused' }; } },
        async close() { agentClosed++; } }))).rejects.toThrow();
    expect(resource).toMatchObject({ opened: 1, closed: 1 });
    expect(agentClosed).toBe(1);
  } finally {
    await new Promise<void>(resolve => reservation.server.close(() => resolve()));
  }
});

async function freePort(): Promise<number> {
  const reservation = await listeningServer();
  await new Promise<void>(resolve => reservation.server.close(() => resolve()));
  return reservation.port;
}

// Verification: Prova della costruzione del server senza ascolto
// Verification: Prova dell'arresto ordinato e limitato del server
test('builds the server without listening and closes its resources once in reverse order of acquisition', async () => {
  const port = await freePort();
  const files = await fixture(port);
  const built = await prepareConversationServer(files.environment, recordingLogger().log,
    async () => ({ orchestrator: { async *produce() { yield { kind: 'text' as const, text: 'unused' }; } },
      async close() { resource.order.push('agents'); } }));
  built.server.addHook('onClose', async () => { resource.order.push('server'); });
  expect(built.address).toEqual({ host: '127.0.0.1', port });
  expect(built.server.server.listening).toBe(false);
  // The configured port is still free: building did not activate the listener.
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  await new Promise<void>(resolve => probe.close(() => resolve()));
  await Promise.all([built.close(), built.close()]);
  expect(resource.order).toEqual(['server', 'archive', 'agents']);
  expect(built.faults).toEqual([]);
});

// Verification: Prova dell'arresto ordinato e limitato del server
test('attempts every closing and keeps each closing fault, named by its resource, in order', async () => {
  const files = await fixture(await freePort());
  const archiveFault = new Error('private archive fault');
  const agentFault = new Error('private agent fault');
  resource.closeFailure = archiveFault;
  const built = await prepareConversationServer(files.environment, recordingLogger().log,
    async () => ({ orchestrator: { async *produce() { yield { kind: 'text' as const, text: 'unused' }; } },
      async close() { resource.order.push('agents'); throw agentFault; } }));
  const failure = await built.close().then(() => undefined, (error: unknown) => error);
  expect(resource.order).toEqual(['archive', 'agents']);
  expect(failure).toBeInstanceOf(LifecycleError);
  const faults = (failure as LifecycleError).faults as ProjectError[];
  expect(faults.map(fault => fault.message)).toEqual(['Conversation archive could not be closed',
    'Agent MCP connections could not be closed']);
  expect(faults.map(fault => fault.cause)).toEqual([archiveFault, agentFault]);
  expect(faults.every(fault => fault instanceof ProjectError)).toBe(true);
  expect(built.faults).toEqual(faults);
});
