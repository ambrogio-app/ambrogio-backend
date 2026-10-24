// Verification: Prova del server compilato come processo
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

// «Server compilato provato come processo»: the compiled entry point of `pnpm build` runs as a child process.
const entryPoint = fileURLToPath(new URL('../dist/main.js', import.meta.url));
let directory: string;

beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'ambrogio-server-e2e-')); });
afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

/** The inherited environment without any AMBROGIO_* variable, plus the given ones. */
function environment(variables: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('AMBROGIO_')));
  return { ...inherited, ...variables };
}

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const address = probe.address();
  await new Promise(resolve => probe.close(resolve));
  if (address === null || typeof address === 'string') throw new Error('No free port');
  return address.port;
}

/** Production settings for a server on a free loopback port, with one answering agent and a temporary archive. */
function productionSettings(port: number): Record<string, string> {
  const agents = join(directory, 'agents');
  mkdirSync(agents);
  const llm = { provider: 'mistral', model: 'mistral-medium-latest', apiKeyEnv: 'MISTRAL_API_KEY' };
  writeFileSync(join(agents, 'orchestrator.json'), `${JSON.stringify({ instructions: 'Choose the agent.', llm })}\n`);
  writeFileSync(join(agents, 'generic.json'),
    `${JSON.stringify({ description: 'Answers general questions.', instructions: 'Answer briefly.', llm })}\n`);
  return { AMBROGIO_ENV: 'production', AMBROGIO_HTTP_HOST: '127.0.0.1', AMBROGIO_HTTP_PORT: String(port),
    AMBROGIO_PUBLIC_HTTPS: 'false', AMBROGIO_ARCHIVE_PATH: join(directory, 'archive.sqlite'),
    AMBROGIO_AGENTS_DIR: agents, MISTRAL_API_KEY: 'e2e-placeholder-key' };
}

async function waitForList(url: string, deadline: number): Promise<Response> {
  for (;;) {
    try { return await fetch(url); }
    catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

describe('compiled server process', () => {
  test('the entry point of the build exists', () => {
    expect(existsSync(entryPoint), 'run pnpm build before pnpm test:e2e').toBe(true);
  });

  test('starts, lists the conversations of a new SQLite archive and stops with 0 on SIGTERM', async () => {
    const port = await freePort();
    const child = spawn(process.execPath, [entryPoint], { env: environment(productionSettings(port)) });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    const exited = new Promise<number | null>(resolve => child.once('exit', code => resolve(code)));
    try {
      const response = await waitForList(`http://127.0.0.1:${port}/api/v1/conversations`, Date.now() + 20_000);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ items: [] });
      expect(existsSync(join(directory, 'archive.sqlite'))).toBe(true);
    } finally { child.kill('SIGTERM'); }
    expect(await exited, `${stdout}${stderr}`).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).not.toContain('e2e-placeholder-key');
  }, 30_000);

  test('exits with 1, one startup failure line and one stderr line without a runtime environment', () => {
    const result = spawnSync(process.execPath, [entryPoint], { env: environment({}), encoding: 'utf8', timeout: 20_000 });
    expect(result.status).toBe(1);
    const lines = result.stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: 50, event: 'server_startup_failed', msg: 'Server startup failed',
      err: { type: 'ProjectError', message: 'Missing environment variable AMBROGIO_ENV' } });
    expect(result.stderr).toBe('Unable to start HTTP server.\n');
  }, 30_000);
});
