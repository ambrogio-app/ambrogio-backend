import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { prepareAgents } from '../../src/composition/agents.js';

async function files() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-agent-composition-'));
  const llm = { provider: 'mistral', model: 'mistral-small-latest', apiKey: 'fake-key' };
  await writeFile(join(directory, 'orchestrator.json'), JSON.stringify({ instructions: 'Coordinate.', llm }));
  return { directory, llm, close: () => rm(directory, { recursive: true, force: true }) };
}

test('prepares every discovered specialist with an isolated MCP connection and closes them', async () => {
  const fixture = await files();
  const connected: string[] = [];
  const closed: string[] = [];
  try {
    for (const id of ['home', 'memory']) {
      await writeFile(join(fixture.directory, `${id}.json`), JSON.stringify({
        description: `${id} description`, maxToolCalls: 3,
        instructions: `${id} instructions`, llm: fixture.llm,
        mcp: { url: `https://${id}.example/mcp` },
      }));
    }
    const agents = await prepareAgents(fixture.directory, async (connection) => {
      connected.push(connection.url);
      return { listTools: async () => [{ name: connection.url, inputSchema: { type: 'object' } }],
        listPrompts: async () => [], getPrompt: async () => '',
        callTool: async () => ({ isError: false, content: [] }),
        close: async () => { closed.push(connection.url); } };
    });
    expect(agents.specialists.map((agent) => agent.id)).toEqual(['home', 'memory']);
    expect(agents.specialists.map((agent) => agent.description)).toEqual([
      'home description', 'memory description',
    ]);
    expect(agents.specialists.map((agent) => agent.tools[0]?.name)).toEqual(connected);
    await agents.close();
    expect(closed).toEqual(connected);
  } finally { await fixture.close(); }
});

test('invalid provider options prevent any MCP connection', async () => {
  const fixture = await files();
  try {
    await writeFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Home.', maxToolCalls: 3, instructions: 'Use tools.',
      llm: { ...fixture.llm, options: { unexpected: 1 } },
      mcp: { url: 'https://home.example/mcp' },
    }));
    let connected = false;
    await expect(prepareAgents(fixture.directory, async () => {
      connected = true;
      throw new Error('Should not connect');
    })).rejects.toMatchObject({ message: 'Invalid agent options: home',
      cause: expect.objectContaining({ message: 'Unsupported model option' }) });
    expect(connected).toBe(false);
  } finally { await fixture.close(); }
});

// Verification: Prova della selezione del modello per agente
test('each agent calls the provider, endpoint and key of its own file', async () => {
  const fixture = await files();
  const seen: Array<{ url: string; authorization: string | null; apiKey: string | null; model: unknown }> = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const body = JSON.parse(await request.text()) as { model?: unknown };
    seen.push({ url: request.url, authorization: request.headers.get('authorization'),
      apiKey: request.headers.get('x-api-key'), model: body.model });
    return new Response('controlled failure', { status: 400 });
  });
  try {
    await writeFile(join(fixture.directory, 'local.json'), JSON.stringify({
      description: 'Local model.', instructions: 'Answer.',
      llm: { provider: 'openai-compatible', model: 'local-model', apiKey: 'local-key',
        baseURL: 'https://models.example/v1' } }));
    await writeFile(join(fixture.directory, 'claude.json'), JSON.stringify({
      description: 'Claude.', instructions: 'Answer.',
      llm: { provider: 'anthropic', model: 'claude-model', apiKey: 'claude-key' } }));
    const agents = await prepareAgents(fixture.directory, async () => { throw new Error('Should not connect'); });
    const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(0),
      turns: [{ id: 'turn', acceptedAt: new Date(0), status: 'pending' as const, text: 'Ciao' }] };
    const never = { requested: new Promise<void>(() => { /* never */ }) };
    for (const agent of agents.specialists) {
      await expect((async () => { for await (const part of agent.reply.produce(history, never)) void part; })())
        .rejects.toThrow();
    }
    expect(agents.specialists.map((agent) => agent.id)).toEqual(['claude', 'local']);
    expect(seen).toEqual([
      { url: 'https://api.anthropic.com/v1/messages', authorization: null, apiKey: 'claude-key', model: 'claude-model' },
      { url: 'https://models.example/v1/chat/completions', authorization: 'Bearer local-key', apiKey: null,
        model: 'local-model' },
    ]);
  } finally {
    vi.unstubAllGlobals();
    await fixture.close();
  }
});

test('closes an earlier MCP connection when a later agent cannot start', async () => {
  const fixture = await files();
  const closed: string[] = [];
  try {
    for (const id of ['home', 'memory']) {
      await writeFile(join(fixture.directory, `${id}.json`), JSON.stringify({
        description: `${id} description`, maxToolCalls: 3, instructions: 'Use tools.',
        llm: fixture.llm, mcp: { url: `https://${id}.example/mcp` },
      }));
    }
    await expect(prepareAgents(fixture.directory, async (connection) => {
      if (connection.url.includes('memory')) throw new Error('MCP unavailable');
      return { listTools: async () => [], listPrompts: async () => [], getPrompt: async () => '',
        callTool: async () => ({ isError: false, content: [] }),
        close: async () => { closed.push(connection.url); } };
    })).rejects.toMatchObject({ message: 'Agent MCP connection failed: memory',
      cause: expect.objectContaining({ message: 'MCP unavailable' }) });
    expect(closed).toEqual(['https://home.example/mcp']);
  } finally { await fixture.close(); }
});

// Verification: Prova dell'agente specializzato senza connettore MCP
test('prepares an agent without MCP without opening any connection', async () => {
  const fixture = await files();
  const connected: string[] = [];
  try {
    await writeFile(join(fixture.directory, 'generic.json'), JSON.stringify({
      description: 'Answers general questions.', instructions: 'Answer from knowledge.', llm: fixture.llm }));
    await writeFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm: fixture.llm,
      mcp: { url: 'https://home.example/mcp' } }));
    const agents = await prepareAgents(fixture.directory, async (connection) => {
      connected.push(connection.url);
      return { listTools: async () => [], listPrompts: async () => [], getPrompt: async () => '',
        callTool: async () => ({ isError: false, content: [] }),
        close: async () => {} };
    });
    expect(agents.specialists.map((agent) => [agent.id, agent.mcp === undefined, agent.tools.length]))
      .toEqual([['generic', true, 0], ['home', false, 0]]);
    expect(connected).toEqual(['https://home.example/mcp']);
    await agents.close();
  } finally { await fixture.close(); }
});

// Verification: Prova delle configurazioni degli agenti con e senza MCP
test('fails before any connection when there is no specialist agent', async () => {
  const fixture = await files();
  try {
    await expect(prepareAgents(fixture.directory, async () => { throw new Error('Should not connect'); }))
      .rejects.toThrow('No specialist agent configured');
  } finally { await fixture.close(); }
});

// Verification: Prova delle istruzioni del server MCP
test('a prompt discovery error at startup is an agent connection failure', async () => {
  const fixture = await files();
  let closed = false;
  try {
    await writeFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm: fixture.llm,
      mcp: { url: 'https://home.example/mcp' } }));
    await expect(prepareAgents(fixture.directory, async () => ({ listTools: async () => [],
      listPrompts: async () => { throw new Error('MCP prompt discovery failed'); },
      getPrompt: async () => '', callTool: async () => ({ isError: false, content: [] }),
      close: async () => { closed = true; } })))
      .rejects.toMatchObject({ message: 'Agent MCP connection failed: home',
        cause: expect.objectContaining({ message: 'MCP prompt discovery failed' }) });
    expect(closed).toBe(true);
  } finally { await fixture.close(); }
});
