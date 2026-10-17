import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { startConversationServer } from '../../src/runtime/conversation-server.js';
import { reportStartupFailure } from '../../src/runtime/startup-failure.js';

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
  const http = join(directory, 'http.json');
  const conversations = join(directory, 'conversations.json');
  await writeFile(http, JSON.stringify({ host: '127.0.0.1', port: options.port ?? await freePort() }));
  await writeFile(conversations, JSON.stringify({ archivePath: options.archive ?? join(directory, 'archive.sqlite') }));
  await writeFile(join(agents, 'orchestrator.json'), JSON.stringify({ instructions: 'Choose.', llm }));
  if (options.specialist !== null) {
    await writeFile(join(agents, 'facts.json'), JSON.stringify(options.specialist
      ?? { description: 'Answers questions.', instructions: 'Answer.', llm }));
  }
  return { directory, agents, environment: { AMBROGIO_HTTP_CONFIG_PATH: http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations } as NodeJS.ProcessEnv };
}

async function startupError(environment: NodeJS.ProcessEnv, agents: string): Promise<unknown> {
  try {
    const runtime = await startConversationServer(environment, agents);
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
  const report = capture(new ProjectError('Invalid HTTP listener configuration'));
  expect(report.lines).toHaveLength(1);
  expect(report.lines[0]).toMatchObject({ level: 50, event: 'server_startup_failed',
    err: { type: 'ProjectError', message: 'Invalid HTTP listener configuration' } });
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

test('names a missing component configuration path', async () => {
  const { agents, environment } = await installation();
  expectReported(await startupError({ ...environment, AMBROGIO_HTTP_CONFIG_PATH: undefined }, agents),
    'Missing HTTP configuration path');
});

test('names an invalid voice configuration file', async () => {
  const { directory, agents, environment } = await installation();
  const voice = join(directory, 'voice.json');
  await writeFile(voice, JSON.stringify({ voskModelPath: secret }));
  expectReported(await startupError({ ...environment, AMBROGIO_VOICE_CONFIG_PATH: voice }, agents),
    'Invalid voice configuration file');
});

test('names a missing specialist agent', async () => {
  const { agents, environment } = await installation({ specialist: null });
  expectReported(await startupError(environment, agents), 'No specialist agent configured');
});

test('names the agent with invalid model options', async () => {
  const { agents, environment } = await installation({ specialist: { description: 'Answers.',
    instructions: 'Answer.', llm: { ...llm, options: { [secret]: true } } } });
  expectReported(await startupError(environment, agents), 'Invalid agent options: facts');
});

test('names the agent whose MCP server cannot be reached without exposing its credentials', async () => {
  const unavailable = await freePort();
  const { agents, environment } = await installation({ specialist: { description: 'Answers.',
    instructions: 'Answer.', llm, maxToolCalls: 2,
    mcp: { url: `http://127.0.0.1:${unavailable}/mcp`, auth: { type: 'bearer', token: secret } } } });
  const error = await startupError(environment, agents);
  expect((error as Error).cause).toBeInstanceOf(Error);
  expectReported(error, 'Agent MCP connection failed: facts');
});

test('names an archive that cannot be opened', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-startup-archive-'));
  directories.push(directory);
  const { agents, environment } = await installation({ archive: join(directory, 'missing', secret, 'a.sqlite') });
  expectReported(await startupError(environment, agents), 'Conversation archive could not be prepared');
});

test('names a listener that cannot start', async () => {
  const { port } = await listeningPort();
  const { agents, environment } = await installation({ port });
  expectReported(await startupError(environment, agents), 'HTTP listener could not start');
});
