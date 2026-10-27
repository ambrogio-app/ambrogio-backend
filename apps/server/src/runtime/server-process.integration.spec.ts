import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { serverEnvironment } from '../../test/support/config-fixture.js';
import { capturedBaseLogger } from '../../test/support/logger-fixture.js';
import { emptyTestDatabase } from '../../../../test/support/test-database.js';
import { prepareConversationServer } from './conversation-server.js';
import { listen, runServerProcess, type ShutdownTimer } from './server-process.js';

// The process runner with the real conversation server, which prepares its archive on a test database.
const directories: string[] = [];
const databases: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  await Promise.all(databases.splice(0).map(drop => drop()));
});

function harness() {
  const signals = new EventEmitter();
  const stderr: string[] = [];
  const output = capturedBaseLogger();
  const timer: ShutdownTimer = () => ({ cancel: () => undefined });
  return { signals, stderr, output,
    options: { log: output.log, signals, timer, stderr: (line: string) => { stderr.push(line); } } };
}

describe('server process with the real conversation server', () => {
  // Verification: Prova della costruzione del server senza ascolto
  it('opens the listener of the real conversation server only at activation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ambrogio-server-process-'));
    directories.push(directory);
    const database = await emptyTestDatabase();
    databases.push(() => database.drop());
    const probe = createServer();
    await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as { port: number }).port;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    const h = harness();
    const listening: boolean[] = [];
    const outcome = runServerProcess({ ...h.options,
      build: async () => {
        const built = await prepareConversationServer(serverEnvironment({ directory,
          database: database.url }, port), h.output.log,
        async () => ({ orchestrator: { async *produce() { yield { kind: 'text' as const, text: 'unused' }; } },
          async close() {} }));
        listening.push(built.server.server.listening);
        return built;
      },
      activate: async built => { await listen(built); listening.push(built.server.server.listening); } });
    for (let attempt = 0; attempt < 50 && listening.length < 2; attempt++) await new Promise(r => setTimeout(r, 20));
    expect(listening).toEqual([false, true]);
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/conversations`);
    expect(response.status).toBe(200);
    h.signals.emit('SIGTERM');
    expect(await outcome).toEqual({ exitCode: 0, force: false });
    expect(h.output.lines()).toEqual([]);
  });
});
