import { serverEnvironment, writeAgentFile } from '../../test/support/config-fixture.js';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { startConversationServer } from '../../test/support/start-server.js';
import { capturedBaseLogger } from '../../test/support/logger-fixture.js';
import { emptyTestDatabase } from '../../../../test/support/test-database.js';
import { reportStartupFailure } from './startup-failure.js';

// The startup failures that happen after the archive is prepared, on a real test database.
const secret = 'startup-secret-marker';
const directories: string[] = [];
const databases: Array<() => Promise<void>> = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  await Promise.all(databases.splice(0).map(drop => drop()));
});

const llm = { provider: 'mistral', model: 'mistral-medium-latest', apiKey: secret };

// Verification: Prova della diagnostica del mancato avvio
test('names a listener that cannot start', async () => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  servers.push(server);
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-startup-failure-'));
  directories.push(directory);
  const agents = join(directory, 'agents');
  await mkdir(agents);
  await writeAgentFile(join(agents, 'orchestrator.json'), JSON.stringify({ instructions: 'Choose.', llm }));
  await writeAgentFile(join(agents, 'facts.json'), JSON.stringify({ description: 'Answers questions.', instructions: 'Answer.', llm }));
  const database = await emptyTestDatabase();
  databases.push(() => database.drop());
  const environment = serverEnvironment({ directory, database: database.url }, (server.address() as AddressInfo).port, agents);

  let error: unknown;
  try { await (await startConversationServer(environment)).close(); } catch (failure) { error = failure; }
  const stdout = capturedBaseLogger();
  const stderr: string[] = [];
  reportStartupFailure(error, stdout.log, line => { stderr.push(line); });
  expect(stdout.lines()).toHaveLength(1);
  expect(stdout.lines()[0]).toMatchObject({ level: 50, event: 'server_startup_failed', msg: 'Server startup failed',
    err: { type: 'ProjectError', message: 'HTTP listener could not start' } });
  expect(stderr.join('')).toBe('Unable to start HTTP server.\n');
  const raw = stdout.output.join('') + stderr.join('');
  expect(raw).not.toContain(secret);
  expect(raw).not.toContain(database.url);
});
