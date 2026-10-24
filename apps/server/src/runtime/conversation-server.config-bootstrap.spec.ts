import { writeConfigFile } from '../../test/support/config-fixture.js';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { startConversationServer } from './conversation-server.js';
import { closeAllClients, ProtocolClient, rejectedUpgradeStatus, takeSchemaViolations } from '../../test/support/protocol-client.js';

const directories: string[] = [];

afterEach(async () => {
  await closeAllClients();
  expect(takeSchemaViolations()).toEqual([]);
  await Promise.all(directories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })));
});

const controlledAgents = async () => ({ orchestrator: { async *produce() {
  yield { kind: 'text' as const, text: 'ok' };
  yield { kind: 'reply_expectation' as const, expectsReply: false };
} }, async close() {} });

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return address.port;
}

test('loads the active component TypeScript once and retains validated values after startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-bootstrap-'));
  directories.push(directory);
  const http = join(directory, 'http.ts');
  const conversations = join(directory, 'conversations.ts');
  const archive = join(directory, 'archive.sqlite');
  const port = await freePort();
  await writeConfigFile(http, JSON.stringify({ host: '127.0.0.1', port,
    allowedOrigins: ['https://allowed.example'], publicHttps: true, hstsMaxAgeSeconds: 120 }));
  await writeConfigFile(conversations, JSON.stringify({ archivePath: archive,
    language: 'it', listPageSize: 2, maxListPageSize: 3 }));

  const runtime = await startConversationServer({
    AMBROGIO_HTTP_CONFIG_PATH: http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations,
    HOST: '0.0.0.0', PORT: String(port + 1),
    AMBROGIO_LANGUAGE: 'en',
  }, directory, controlledAgents);
  try {
    const request = () => fetch(`http://127.0.0.1:${port}/api/conversations`, {
      headers: { origin: 'https://allowed.example' },
    });
    const before = await request();
    expect(before.status).toBe(200);
    expect(before.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
    expect(before.headers.get('strict-transport-security')).toBe('max-age=120');
    expect((await before.json() as { items: unknown[] }).items).toEqual([]);

    await writeConfigFile(http, '{ "secret": "must-not-reload"');
    await writeConfigFile(conversations, '{ "secret": "must-not-reload"');
    const after = await request();
    expect(after.status).toBe(200);
    expect(after.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
    expect(after.headers.get('strict-transport-security')).toBe('max-age=120');
    expect((await after.json() as { items: unknown[] }).items).toEqual([]);
  } finally {
    await runtime.close();
  }
});

test('rejects a secret-bearing invalid component TypeScript before opening its archive or listener', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-bootstrap-'));
  directories.push(directory);
  const http = join(directory, 'http.ts');
  const conversations = join(directory, 'conversations.ts');
  const archive = join(directory, 'archive.sqlite');
  const port = await freePort();
  await writeConfigFile(http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeConfigFile(conversations, JSON.stringify({ archivePath: { secret: 'private-marker' } }));

  let failure: unknown;
  try {
    await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations }, directory, controlledAgents);
  } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toBe('Invalid conversation archive path');
  expect(String(failure)).not.toContain('private-marker');
  await expect(access(archive)).rejects.toMatchObject({ code: 'ENOENT' });

  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>(resolve => probe.close(() => resolve()));
});

// Verification: Prova dell'agente specializzato senza connettore MCP
test('uses the validated agent, HTTP and conversation TypeScript throughout the active server', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-bootstrap-'));
  directories.push(directory);
  const http = join(directory, 'http.ts');
  const conversations = join(directory, 'conversations.ts');
  const archive = join(directory, 'archive.sqlite');
  const agents = join(directory, 'agents');
  const port = await freePort();
  await mkdir(agents);
  await writeConfigFile(http, JSON.stringify({ host: '127.0.0.1', port,
    allowedOrigins: ['https://allowed.example'] }));
  await writeConfigFile(conversations, JSON.stringify({ archivePath: archive, language: 'it' }));
  await writeConfigFile(join(agents, 'orchestrator.ts'), JSON.stringify({
    instructions: 'Scegli l\'agente.',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'json-router-key' },
  }));
  // An agent with instructions only: no MCP section and no tool call limit.
  await writeConfigFile(join(agents, 'generic.ts'), JSON.stringify({
    description: 'Risponde alle domande generali.', instructions: 'Rispondi brevemente.',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'json-agent-key' },
  }));

  const seen: Array<{ authorization: string | null; body: unknown }> = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const body = JSON.parse(await request.text()) as { stream?: boolean; tools?: unknown };
    seen.push({ authorization: request.headers.get('authorization'), body });
    if (!body.stream) {
      return Response.json({ id: 'controlled-0', object: 'chat.completion', created: 0,
        model: 'mistral-medium-latest', choices: [{ index: 0,
          message: { role: 'assistant', content: '{"agent":"generic"}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    }
    const event = { id: 'controlled-1', object: 'chat.completion.chunk', created: 0,
      model: 'mistral-small-latest', choices: [{ index: 0, delta: { content: '{"answer":"Risposta","expectsReply":false}' },
        finish_reason: null }] };
    return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  });
  try {
    const runtime = await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations, HOST: '0.0.0.0',
      PORT: String(port + 1), AMBROGIO_LANGUAGE: 'en' }, agents);
    try {
      const url = `ws://127.0.0.1:${port}/api/session`;
      const exercise = async () => {
        const client = await ProtocolClient.ready(url, { origin: 'https://allowed.example' });
        const answered = await client.textTurn('Domanda');
        expect(answered.final.type).toBe('turn.completed');
        expect(answered.outputs[0]!.text).toBe('Risposta');
        const invalid = await client.textTurn('');
        expect(invalid.final).toMatchObject({ type: 'turn.rejected', message: 'Messaggio non valido.' });
        expect(await rejectedUpgradeStatus(url, { origin: 'https://other.example' })).toBe(403);
        const list = await runtime.server.inject({ method: 'GET', url: '/api/conversations',
          headers: { origin: 'https://allowed.example' } });
        expect(list.headers['access-control-allow-origin']).toBe('https://allowed.example');
        await client.close();
      };
      await exercise();

      await writeConfigFile(http, '{');
      await writeConfigFile(conversations, '{');
      await writeConfigFile(join(agents, 'orchestrator.ts'), '{');
      await exercise();
      expect(seen.map(request => request.authorization)).toEqual([
        'Bearer json-router-key', 'Bearer json-agent-key', 'Bearer json-router-key', 'Bearer json-agent-key',
      ]);
      const system = (request: typeof seen[number]) => (request.body as { messages?: Array<{ content: string }> })
        .messages?.[0]?.content ?? '';
      expect(seen.map(request => system(request).split('\n')[0])).toEqual([
        'Scegli l\'agente.', 'Rispondi brevemente.', 'Scegli l\'agente.', 'Rispondi brevemente.',
      ]);
      // The agent without MCP is offered no tools.
      expect(seen.every(request => (request.body as { tools?: unknown }).tools === undefined)).toBe(true);
    } finally { await runtime.close(); }
  } finally { vi.unstubAllGlobals(); }
});
