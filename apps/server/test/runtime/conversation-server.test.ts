import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/sqlite/archive';
import { McpToolClient } from '@ambrogio/conversations/adapters/out/mcp-tool-client';
import { MistralOrchestratorReply, MistralToolAgentReply } from '@ambrogio/conversations/adapters/out/mistral-function-reply';
import { prepareConfiguredConversations } from '../../src/composition/conversations.js';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';
import { buildConversationServer } from '../../src/runtime/consultation-server.js';
import { startConversationServer } from '../../src/runtime/conversation-server.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) =>
  rm(path, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-conversation-server-'));
  directories.push(directory);
  return { directory, http: join(directory, 'http.json'),
    conversations: join(directory, 'conversations.json'), archive: join(directory, 'archive.sqlite') };
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

test('POST/SSE uses the orchestrator and retains security, CORS and correlation headers', async () => {
  const files = await fixture();
  const prepared = await prepareConfiguredConversations({ archivePath: files.archive,
    listPageSize: 20, maxListPageSize: 100, language: 'en' }, new Date());
  const { server, turnIngress } = await buildConversationServer({ host: '127.0.0.1', port: 3000,
    allowedOrigins: ['https://client.test'], publicHttps: true, hstsMaxAgeSeconds: 600 },
  prepared, { async *produce() { yield 'Hello'; yield ' world'; } });
  try {
    const preflight = await server.inject({ method: 'OPTIONS', url: '/api/conversations/turns',
      headers: { origin: 'https://client.test', 'access-control-request-method': 'POST' } });
    expect(preflight.headers['access-control-allow-methods']).toContain('POST');
    expect(preflight.headers['access-control-allow-origin']).toBe('https://client.test');
    const rejected = await server.inject({ method: 'OPTIONS', url: '/api/conversations/turns',
      headers: { origin: 'https://other.test', 'access-control-request-method': 'POST' } });
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    const turn = await server.inject({ method: 'POST', url: '/api/conversations/turns',
      headers: { origin: 'https://client.test', 'content-type': 'application/json' },
      payload: { text: 'Hi' } });
    expect(turn.statusCode).toBe(200);
    expect(turn.body).toContain('event: conversation');
    expect(turn.body).toContain('event: delta');
    expect(turn.body).toContain('event: done');
    expect(turn.headers['content-type']).toContain('text/event-stream');
    expect(turn.headers['cache-control']).toBe('no-store');
    expect(turn.headers['strict-transport-security']).toBe('max-age=600');
    expect(turn.headers['x-content-type-options']).toBe('nosniff');
    expect(turn.headers['x-request-id'])
      .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const invalid = await server.inject({ method: 'POST', url: '/api/conversations/turns',
      headers: { origin: 'https://client.test', 'content-type': 'application/json' },
      payload: { text: '' } });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.headers['cache-control']).toBe('no-store');
    expect(invalid.headers['strict-transport-security']).toBe('max-age=600');
    expect(invalid.headers['x-content-type-options']).toBe('nosniff');
    expect(invalid.headers['x-request-id'])
      .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(invalid.headers['x-request-id']).not.toBe(turn.headers['x-request-id']);
    const list = await server.inject({ method: 'GET', url: '/api/conversations' });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    await turnIngress.stopAccepting();
    const afterStop = await server.inject({ method: 'POST', url: '/api/conversations/turns',
      headers: { 'content-type': 'application/json' }, payload: { text: 'too late' } });
    expect(afterStop.statusCode).toBe(503);
    expect((await server.inject({ method: 'GET', url: '/api/conversations' })).json().items)
      .toHaveLength(1);
  } finally {
    await server.close();
    await prepared.archive.close();
  }
});

test('shutdown interrupts a pending turn without waiting for the remote reply', async () => {
  const files = await fixture();
  const port = await freePort();
  await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
  let started!: () => void;
  const producing = new Promise<void>((resolve) => { started = resolve; });
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  let closed = false;
  let persistedBeforeAgentClose = false;
  const runtime = await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }, files.directory,
  async () => ({ orchestrator: { async *produce() { started(); await wait; yield 'too late'; } },
    async close() {
      const archive = await openConversationArchive(files.archive, new Date());
      try {
        const rows = await archive.db.selectFrom('turns').select(['status', 'answer']).execute();
        persistedBeforeAgentClose = rows.length === 1 && rows[0]?.status === 'interrupted'
          && rows[0].answer === null;
      } finally { await archive.close(); }
      closed = true;
    } }));
  const origin = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(`${origin}/api/conversations/turns`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Hi' }) });
    expect(response.status).toBe(200);
    await producing;
    const closing = runtime.close();
    const rejectedDuringShutdown = runtime.server.inject({ method: 'POST',
      url: '/api/conversations/turns', headers: { 'content-type': 'application/json' },
      payload: { text: 'too late to start' } });
    await expect(Promise.race([closing, new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown waited for remote reply')), 1000))])).resolves.toBeUndefined();
    expect(closed).toBe(true);
    expect(persistedBeforeAgentClose).toBe(true);
    const lateAdmission = await rejectedDuringShutdown.catch(() => undefined);
    if (lateAdmission) expect(lateAdmission.statusCode).not.toBe(200);
    release();
    expect(await response.text().catch(() => '')).not.toContain('event: done');
    await new Promise<void>((resolve) => setImmediate(resolve));
    const archive = await openConversationArchive(files.archive, new Date());
    try {
      expect(archive.recoveredTurns).toBe(0);
      const rows = await archive.db.selectFrom('turns').select(['status', 'answer']).execute();
      expect(rows).toEqual([{ status: 'interrupted', answer: null }]);
    } finally { await archive.close(); }
    const restarted = await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }, files.directory,
    async () => ({ orchestrator: { async *produce() { yield 'after restart'; } },
      async close() {} }));
    try {
      const next = await fetch(`${origin}/api/conversations/turns`, { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Again' }) });
      expect(next.status).toBe(200);
      expect(await next.text()).toContain('after restart');
    } finally { await restarted.close(); }
  } finally {
    release();
    await runtime.close();
  }
});

test('shutdown preserves a turn already completed before interruption', async () => {
  const files = await fixture();
  const port = await freePort();
  await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
  const runtime = await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }, files.directory,
  async () => ({ orchestrator: { async *produce() { yield 'completed answer'; } },
    async close() {} }));
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/conversations/turns`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Finish first' }),
    });
    expect(await response.text()).toContain('event: done');
    await runtime.close();
    const archive = await openConversationArchive(files.archive, new Date());
    try {
      expect(archive.recoveredTurns).toBe(0);
      expect(await archive.db.selectFrom('turns').select(['status', 'answer']).execute())
        .toEqual([{ status: 'answered', answer: 'completed answer' }]);
    } finally { await archive.close(); }
  } finally { await runtime.close(); }
});

test('invalid agent files prevent the conversation listener from starting', async () => {
  const files = await fixture();
  const port = await freePort();
  await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
  await writeFile(join(files.directory, 'orchestrator.json'), '{');
  await expect(startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }, files.directory))
    .rejects.toThrow('Invalid agent configuration: orchestrator');
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});

test('POST/SSE delegates to a configured MCP tool and persists the answer', async () => {
  const files = await fixture();
  const agentDirectory = join(files.directory, 'agents');
  await mkdir(agentDirectory);
  const port = await freePort();
  const calls: string[] = [];
  const mcpServer = createHttpServer(async (request, reply) => {
    let body = '';
    for await (const chunk of request) body += chunk.toString();
    const rpc = body ? JSON.parse(body) as { id?: number; method?: string;
      params?: { name?: string } } : {};
    if (rpc.method === 'notifications/initialized') { reply.writeHead(202).end(); return; }
    const result = rpc.method === 'initialize'
      ? { protocolVersion: '2025-11-25', capabilities: { tools: {} },
        serverInfo: { name: 'controlled-mcp', version: '1.0.0' } }
      : rpc.method === 'tools/list'
        ? { tools: [{ name: 'lookup', description: 'Look up a fact',
          inputSchema: { type: 'object', properties: { key: { type: 'string' } } } }] }
        : rpc.method === 'tools/call'
          ? { content: [{ type: 'text', text: 'fact from MCP' }] } : undefined;
    if (rpc.method === 'tools/call') calls.push(rpc.params?.name ?? '');
    if (!result) { reply.writeHead(404).end(); return; }
    reply.writeHead(200, { 'content-type': 'application/json' });
    reply.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  await new Promise<void>((resolve) => mcpServer.listen(0, '127.0.0.1', resolve));
  const address = mcpServer.address();
  if (!address || typeof address === 'string') throw new Error('No MCP port');
  await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
  const llm = { provider: 'mistral', model: 'controlled-model', apiKey: 'fake-key' };
  await writeFile(join(agentDirectory, 'orchestrator.json'), JSON.stringify({
    instructions: 'Delegate fact lookups.', llm,
  }));
  await writeFile(join(agentDirectory, 'facts.json'), JSON.stringify({
    instructions: 'Use lookup.', description: 'Find facts.', maxToolCalls: 1, llm,
    mcp: { url: `http://127.0.0.1:${address.port}/mcp` },
  }));
  const modelRequests: Array<{ model: string; instructions: string }> = [];
  let orchestratorStep = 0;
  let runtime: Awaited<ReturnType<typeof startConversationServer>> | undefined;
  try {
    runtime = await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }, agentDirectory,
    async (directory) => {
      const configs = await loadAgentConfigs(directory);
      const config = configs.specialists[0]!;
      const mcp = await McpToolClient.connect(config.mcp!);
      try {
        const tools = await mcp.listTools();
        let specialistStep = 0;
        const specialist = new MistralToolAgentReply({ instructions: config.instructions,
          model: config.llm.model, apiKey: config.llm.apiKey },
          tools, mcp, config.maxToolCalls!, async (request) => {
            modelRequests.push({ model: request.model, instructions: request.messages[0]?.content ?? '' });
            return (async function* () {
              if (specialistStep++ === 0) yield { data: { choices: [{ delta: { toolCalls: [{
                id: 'tool-1', index: 0, function: { name: 'mcp_0', arguments: '{"key":"answer"}' },
              }] } }] } };
              else yield { data: { choices: [{ delta: { content: 'Answer from tool.' } }] } };
            })();
          });
        const orchestrator = new MistralOrchestratorReply({
          instructions: configs.orchestrator.instructions, model: configs.orchestrator.llm.model,
          apiKey: configs.orchestrator.llm.apiKey,
        }, [{ id: config.id, description: config.description!, reply: specialist }],
        async (request) => {
          modelRequests.push({ model: request.model, instructions: request.messages[0]?.content ?? '' });
          expect(request.tools?.[0]?.function.description).toBe('Find facts.');
          return (async function* () {
            if (orchestratorStep++ === 0) yield { data: { choices: [{ delta: { toolCalls: [{
              id: 'delegate-1', index: 0, function: { name: 'delegate_0', arguments: '{"task":"Find answer"}' },
            }] } }] } };
            else yield { data: { choices: [{ delta: { content: 'Direct answer.' } }] } };
          })();
        });
        return { orchestrator, close: () => mcp.close() };
      } catch (error) { await mcp.close(); throw error; }
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/conversations/turns`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'What is the answer?' }),
    });
    expect(response.status).toBe(200);
    const events = await response.text();
    expect(events).toContain('event: conversation');
    expect(events).toContain('event: delta');
    expect(events).toContain('Answer from tool.');
    expect(events).toContain('event: done');
    expect(calls).toEqual(['lookup']);
    const list = await fetch(`http://127.0.0.1:${port}/api/conversations`);
    const items = (await list.json() as { items: Array<{ id: string }> }).items;
    expect(items).toHaveLength(1);
    const direct = await fetch(`http://127.0.0.1:${port}/api/conversations/turns`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: items[0]!.id, text: 'Answer directly.' }),
    });
    expect(direct.status).toBe(200);
    expect(await direct.text()).toContain('Direct answer.');
    expect(calls).toEqual(['lookup']);
    expect(modelRequests).toEqual([
      { model: 'controlled-model', instructions: 'Delegate fact lookups.' },
      { model: 'controlled-model', instructions: 'Use lookup.' },
      { model: 'controlled-model', instructions: 'Use lookup.' },
      { model: 'controlled-model', instructions: 'Delegate fact lookups.' },
    ]);
    const history = await fetch(`http://127.0.0.1:${port}/api/conversations/${items[0]!.id}`);
    const turns = (await history.json() as { turns: Array<{ answer: string }> }).turns;
    expect(turns.map((turn) => turn.answer)).toEqual(['Answer from tool.', 'Direct answer.']);
  } finally {
    await runtime?.close();
    await new Promise<void>((resolve) => mcpServer.close(() => resolve()));
  }
});

test('unavailable configured MCP connector prevents the conversation listener', async () => {
  const files = await fixture();
  const agentDirectory = join(files.directory, 'agents');
  await mkdir(agentDirectory);
  const port = await freePort();
  const unavailablePort = await freePort();
  await writeFile(files.http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeFile(files.conversations, JSON.stringify({ archivePath: files.archive }));
  const llm = { provider: 'mistral', model: 'controlled-model', apiKey: 'fake-key' };
  await writeFile(join(agentDirectory, 'orchestrator.json'), JSON.stringify({
    instructions: 'Delegate.', llm,
  }));
  await writeFile(join(agentDirectory, 'facts.json'), JSON.stringify({
    instructions: 'Use lookup.', description: 'Find facts.', maxToolCalls: 1, llm,
    mcp: { url: `http://127.0.0.1:${unavailablePort}/mcp` },
  }));
  await expect(startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: files.http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: files.conversations }, agentDirectory))
    .rejects.toThrow('MCP connection failed');
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});
