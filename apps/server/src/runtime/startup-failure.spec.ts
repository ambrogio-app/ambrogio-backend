import { serverEnvironment, writeAgentFile } from '../../test/support/config-fixture.js';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { startConversationServer } from './conversation-server.js';
import { reportStartupFailure } from './startup-failure.js';

const secret = 'startup-secret-marker';
const directories: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function capture(error: unknown) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  reportStartupFailure(error, {
    stdout: { write: (line: string) => { stdout.push(line); } },
    stderr: { write: (line: string) => { stderr.push(line); return true; } },
  });
  return { lines: stdout.join('').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>),
    raw: stdout.join('') + stderr.join(''), stderr: stderr.join('') };
}

async function listeningPort(): Promise<{ port: number; server: Server }> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  servers.push(server);
  return { port: (server.address() as AddressInfo).port, server };
}

async function freePort(): Promise<number> {
  const { port, server } = await listeningPort();
  servers.splice(servers.indexOf(server), 1);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const llm = { provider: 'mistral', model: 'mistral-medium-latest', apiKey: secret };

async function installation(options: Readonly<{ port?: number; archive?: string; specialist?: unknown }> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-startup-failure-'));
  directories.push(directory);
  const agents = join(directory, 'agents');
  await mkdir(agents);
  await writeAgentFile(join(agents, 'orchestrator.json'), JSON.stringify({ instructions: 'Choose.', llm }));
  if (options.specialist !== null) {
    await writeAgentFile(join(agents, 'facts.json'), JSON.stringify(options.specialist
      ?? { description: 'Answers questions.', instructions: 'Answer.', llm }));
  }
  const port = options.port ?? await freePort();
  return { directory, environment: serverEnvironment({ directory,
    archive: options.archive ?? join(directory, 'archive.sqlite') }, port, agents) };
}

async function startupError(environment: NodeJS.ProcessEnv): Promise<unknown> {
  try {
    const runtime = await startConversationServer(environment);
    await runtime.close();
  } catch (error) { return error; }
  throw new Error('The server started unexpectedly');
}

function expectReported(error: unknown, message: string) {
  const report = capture(error);
  expect(report.lines).toHaveLength(1);
  expect(report.lines[0]).toMatchObject({ level: 50, event: 'server_startup_failed', msg: 'Server startup failed',
    err: { type: 'ProjectError', message } });
  expect(report.stderr).toBe('Unable to start HTTP server.\n');
  expect(report.raw).not.toContain(secret);
}

test('reports a project error once on stdout and the fixed line on stderr', () => {
  const report = capture(new ProjectError('Missing environment variable AMBROGIO_HTTP_HOST'));
  expect(report.lines).toHaveLength(1);
  expect(report.lines[0]).toMatchObject({ level: 50, event: 'server_startup_failed',
    err: { type: 'ProjectError', message: 'Missing environment variable AMBROGIO_HTTP_HOST' } });
  expect(String((report.lines[0]?.err as { stack: string }).stack)).toContain('ProjectError');
  expect(report.stderr).toBe('Unable to start HTTP server.\n');
});

test('keeps external failures opaque', () => {
  const external = Object.assign(new Error(`driver said ${secret}`), { token: secret });
  for (const value of [external, secret, { secret }]) {
    const report = capture(value);
    expect(report.lines[0]).toMatchObject({ event: 'server_startup_failed',
      err: { type: 'Error', message: 'Unexpected startup failure', stack: '[redacted]' } });
    expect(report.raw).not.toContain(secret);
  }
});

// Verification: Prova della diagnostica del mancato avvio
test('names a missing configuration variable', async () => {
  const { environment } = await installation();
  expectReported(await startupError({ ...environment, AMBROGIO_ENV: 'production', AMBROGIO_HTTP_HOST: undefined }),
    'Missing environment variable AMBROGIO_HTTP_HOST');
  expectReported(await startupError({ ...environment, AMBROGIO_ENV: undefined }),
    'Missing environment variable AMBROGIO_ENV');
});

// Verification: Prova della diagnostica del mancato avvio
test('names an invalid configuration variable and the unmet condition without its value', async () => {
  const { environment } = await installation();
  expectReported(await startupError({ ...environment, AMBROGIO_HTTP_PORT: secret }),
    'Invalid environment variable AMBROGIO_HTTP_PORT: expected an integer from 1 to 65535');
  expectReported(await startupError({ ...environment, AMBROGIO_ENV: secret }),
    'Invalid environment variable AMBROGIO_ENV: expected development, test or production');
  expectReported(await startupError({ ...environment, AMBROGIO_VOICE_LANGUAGES: 'en',
    AMBROGIO_VOICE_EN_VOSK_MODEL_PATH: secret, AMBROGIO_VOICE_EN_ENGINE: 'kokoro', AMBROGIO_VOICE_EN_MODEL_DIR: secret,
    AMBROGIO_VOICE_EN_SPEAKER: secret, AMBROGIO_VOICE_EN_LANGUAGE: 'en' }),
  'Invalid environment variable AMBROGIO_VOICE_EN_SPEAKER: expected an integer from 0');
});

// Verification: Prova della diagnostica del mancato avvio
test('names the variable of a missing agent credential', async () => {
  const { environment } = await installation({ specialist: { description: 'Answers.', instructions: 'Answer.',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKeyEnv: 'FACTS_API_KEY' } } });
  expectReported(await startupError(environment), 'Missing environment variable FACTS_API_KEY for agent facts');
});

test('names a missing specialist agent', async () => {
  const { environment } = await installation({ specialist: null });
  expectReported(await startupError(environment), 'No specialist agent configured');
});

test('names the agent with invalid model options', async () => {
  const { environment } = await installation({ specialist: { description: 'Answers.',
    instructions: 'Answer.', llm: { ...llm, options: { [secret]: true } } } });
  expectReported(await startupError(environment), 'Invalid agent options: facts');
});

test('names the agent whose MCP server cannot be reached without exposing its credentials', async () => {
  const unavailable = await freePort();
  const { environment } = await installation({ specialist: { description: 'Answers.',
    instructions: 'Answer.', llm, maxToolCalls: 2,
    mcp: { url: `http://127.0.0.1:${unavailable}/mcp`, auth: { type: 'bearer', token: secret } } } });
  const error = await startupError(environment);
  expect((error as Error).cause).toBeInstanceOf(Error);
  expectReported(error, 'Agent MCP connection failed: facts');
});

test('names an archive that cannot be opened', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-startup-archive-'));
  directories.push(directory);
  const { environment } = await installation({ archive: join(directory, 'missing', secret, 'a.sqlite') });
  expectReported(await startupError(environment), 'Conversation archive could not be prepared');
});

test('names a listener that cannot start', async () => {
  const { port } = await listeningPort();
  const { environment } = await installation({ port });
  expectReported(await startupError(environment), 'HTTP listener could not start');
});
