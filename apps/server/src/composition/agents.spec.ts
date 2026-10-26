import { testEnvironment, writeAgentFile } from '../../test/support/config-fixture.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { prepareAgents } from './agents.js';

async function files() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-agent-composition-'));
  const llm = { provider: 'mistral', model: 'mistral-small-latest', apiKey: 'fake-key' };
  await writeAgentFile(join(directory, 'orchestrator.json'), JSON.stringify({ instructions: 'Coordinate.', llm }));
  return { directory, llm, close: () => rm(directory, { recursive: true, force: true }) };
}

test('prepares every discovered specialist with an isolated MCP connection and closes them', async () => {
  const fixture = await files();
  const connected: string[] = [];
  const closed: string[] = [];
  try {
    for (const id of ['home', 'memory']) {
      await writeAgentFile(join(fixture.directory, `${id}.json`), JSON.stringify({
        description: `${id} description`, maxToolCalls: 3,
        instructions: `${id} instructions`, llm: fixture.llm,
        mcp: { url: `https://${id}.example/mcp` },
      }));
    }
    const agents = await prepareAgents(fixture.directory, testEnvironment(), async (connection) => {
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
    // Each connection is closed once, in reverse order of opening.
    expect(closed).toEqual([...connected].reverse());
  } finally { await fixture.close(); }
});

// Verification: Prova della selezione degli strumenti MCP
test('offers only the listed tools and refuses to start when a listed tool is missing', async () => {
  const fixture = await files();
  const discovered = ['alpha', 'light.toggle', 'beta', 'gamma'].map((name) => ({ name, inputSchema: { type: 'object' } }));
  const closed: string[] = [];
  const connect = async (connection: { url: string }) => ({ listTools: async () => discovered,
    listPrompts: async () => [], getPrompt: async () => '',
    callTool: async () => ({ isError: false, content: [] }),
    close: async () => { closed.push(connection.url); } });
  try {
    const base = { description: 'Weather.', maxToolCalls: 3, instructions: 'Use tools.', llm: fixture.llm };
    await writeAgentFile(join(fixture.directory, 'all.json'), JSON.stringify({ ...base,
      mcp: { url: 'https://all.example/mcp' } }));
    await writeAgentFile(join(fixture.directory, 'some.json'), JSON.stringify({ ...base,
      mcp: { url: 'https://some.example/mcp', auth: { type: 'bearer', token: 'secret-token' },
        tools: ['gamma', 'light.toggle'] } }));
    const agents = await prepareAgents(fixture.directory, testEnvironment(), connect);
    expect(agents.specialists.map((agent) => agent.tools.map((tool) => tool.name))).toEqual([
      ['alpha', 'light.toggle', 'beta', 'gamma'], ['light.toggle', 'gamma']]);
    await agents.close();

    closed.length = 0;
    await writeAgentFile(join(fixture.directory, 'some.json'), JSON.stringify({ ...base,
      mcp: { url: 'https://some.example/mcp', auth: { type: 'bearer', token: 'secret-token' },
        tools: ['gamma', 'delta'] } }));
    const failure = await prepareAgents(fixture.directory, testEnvironment(), connect).catch((error: unknown) => error);
    expect(failure).toMatchObject({ message: 'Agent MCP tool unavailable: some' });
    expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toMatch(/some\.example|secret-token/);
    expect(closed).toEqual(['https://some.example/mcp', 'https://all.example/mcp']);
  } finally { await fixture.close(); }
});

test('invalid provider options prevent any MCP connection', async () => {
  const fixture = await files();
  try {
    await writeAgentFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Home.', maxToolCalls: 3, instructions: 'Use tools.',
      llm: { ...fixture.llm, options: { unexpected: 1 } },
      mcp: { url: 'https://home.example/mcp' },
    }));
    let connected = false;
    await expect(prepareAgents(fixture.directory, testEnvironment(), async () => {
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
    await writeAgentFile(join(fixture.directory, 'local.json'), JSON.stringify({
      description: 'Local model.', instructions: 'Answer.',
      llm: { provider: 'openai-compatible', model: 'local-model', apiKey: 'local-key',
        baseURL: 'https://models.example/v1' } }));
    await writeAgentFile(join(fixture.directory, 'claude.json'), JSON.stringify({
      description: 'Claude.', instructions: 'Answer.',
      llm: { provider: 'anthropic', model: 'claude-model', apiKey: 'claude-key' } }));
    const agents = await prepareAgents(fixture.directory, testEnvironment(), async () => { throw new Error('Should not connect'); });
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

// Verification: Prova della data corrente per gli agenti
test('specialists receive the date line in the given time zone and the orchestrator does not', async () => {
  const fixture = await files();
  const systems: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(await new Request(input, init).text()) as { messages?: Array<{ content?: unknown }> };
    systems.push(String(body.messages?.[0]?.content));
    return new Response('controlled failure', { status: 400 });
  });
  try {
    await writeAgentFile(join(fixture.directory, 'generic.json'), JSON.stringify({
      description: 'General questions.', instructions: 'Answer.', llm: fixture.llm }));
    const clock = { now: () => new Date('2026-10-19T07:41:00Z') };
    const agents = await prepareAgents(fixture.directory, testEnvironment(), async () => { throw new Error('Should not connect'); },
      { timeZone: 'Europe/Rome', clock });
    const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(0),
      turns: [{ id: 'turn', acceptedAt: new Date(0), status: 'pending' as const, text: 'Ciao' }] };
    const never = { requested: new Promise<void>(() => { /* never */ }) };
    for (const reply of [agents.specialists[0]!.reply, agents.orchestrator]) {
      await expect((async () => { for await (const part of reply.produce(history, never)) void part; })())
        .rejects.toThrow();
    }
    expect(systems[0]).toContain('Answer.\nCurrent date and time: Monday, 19 October 2026 at 09:41 (Europe/Rome).');
    expect(systems[1]).toContain('Coordinate.');
    expect(systems[1]).not.toContain('Current date and time');
  } finally {
    vi.unstubAllGlobals();
    await fixture.close();
  }
});

// Verification: Prova della lingua nelle istruzioni degli agenti
test('applies the configured response language to specialists but not the orchestrator', async () => {
  const fixture = await files();
  const systems: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(await new Request(input, init).text()) as { messages?: Array<{ content?: unknown }> };
    systems.push(String(body.messages?.[0]?.content));
    return new Response('controlled failure', { status: 400 });
  });
  try {
    await writeAgentFile(join(fixture.directory, 'generic.json'), JSON.stringify({
      description: 'General questions.', instructions: 'Answer briefly.', llm: fixture.llm }));
    await writeAgentFile(join(fixture.directory, 'weather.json'), JSON.stringify({
      description: 'Weather.', instructions: 'Use the forecast.', llm: fixture.llm, maxToolCalls: 1,
      mcp: { url: 'https://weather.example/mcp' } }));
    const connect = async () => ({
      listTools: async () => [], listPrompts: async () => ['context'],
      getPrompt: async () => 'Weather context.', callTool: async () => ({ isError: false, content: [] }),
      close: async () => {},
    });
    const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(0),
      turns: [{ id: 'turn', acceptedAt: new Date(0), status: 'pending' as const, text: 'Hello' }] };
    const never = { requested: new Promise<void>(() => { /* never */ }) };
    for (const language of ['it', 'en'] as const) {
      const agents = await prepareAgents(fixture.directory, testEnvironment(), connect, undefined, language);
      try {
        for (const reply of [...agents.specialists.map(agent => agent.reply), agents.orchestrator]) {
          await expect((async () => { for await (const part of reply.produce(history, never)) void part; })())
            .rejects.toThrow();
        }
      } finally { await agents.close(); }
    }
    // Per language: the generic agent, the weather agent with its announcement call, and the orchestrator.
    expect(systems).toHaveLength(8);
    const orchestrators: string[] = [];
    for (const [block, language] of [[systems.slice(0, 4), 'Italian'], [systems.slice(4), 'English']] as const) {
      const weather = block.filter(system => system.startsWith('Use the forecast.'));
      const announcement = weather.find(system => system.includes('You are not answering now.'));
      const reply = weather.find(system => !system.includes('You are not answering now.'));
      const orchestrator = block.find(system => !system.startsWith('Use the forecast.')
        && !system.startsWith('Answer briefly.'));
      expect(block.find(system => system.startsWith('Answer briefly.'))).toContain(`Answer in ${language}.`);
      expect(reply).toContain(`Weather context.\nAnswer in ${language}.`);
      expect(announcement).toContain(`Write in ${language}.`);
      expect(announcement).not.toContain('Weather context.');
      expect(orchestrator).not.toContain('Answer in Italian.');
      expect(orchestrator).not.toContain('Answer in English.');
      orchestrators.push(orchestrator!);
    }
    // The language leaves the orchestrator's role untouched: it receives the same instructions in both languages.
    expect(orchestrators[1]).toBe(orchestrators[0]);
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
      await writeAgentFile(join(fixture.directory, `${id}.json`), JSON.stringify({
        description: `${id} description`, maxToolCalls: 3, instructions: 'Use tools.',
        llm: fixture.llm, mcp: { url: `https://${id}.example/mcp` },
      }));
    }
    await expect(prepareAgents(fixture.directory, testEnvironment(), async (connection) => {
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
    await writeAgentFile(join(fixture.directory, 'generic.json'), JSON.stringify({
      description: 'Answers general questions.', instructions: 'Answer from knowledge.', llm: fixture.llm }));
    await writeAgentFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm: fixture.llm,
      mcp: { url: 'https://home.example/mcp' } }));
    const agents = await prepareAgents(fixture.directory, testEnvironment(), async (connection) => {
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
    await expect(prepareAgents(fixture.directory, testEnvironment(), async () => { throw new Error('Should not connect'); }))
      .rejects.toThrow('No specialist agent configured');
  } finally { await fixture.close(); }
});

// Verification: Prova delle istruzioni del server MCP
test('a prompt discovery error at startup is an agent connection failure', async () => {
  const fixture = await files();
  let closed = false;
  try {
    await writeAgentFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm: fixture.llm,
      mcp: { url: 'https://home.example/mcp' } }));
    await expect(prepareAgents(fixture.directory, testEnvironment(), async () => ({ listTools: async () => [],
      listPrompts: async () => { throw new Error('MCP prompt discovery failed'); },
      getPrompt: async () => '', callTool: async () => ({ isError: false, content: [] }),
      close: async () => { closed = true; } })))
      .rejects.toMatchObject({ message: 'Agent MCP connection failed: home',
        cause: expect.objectContaining({ message: 'MCP prompt discovery failed' }) });
    expect(closed).toBe(true);
  } finally { await fixture.close(); }
});
