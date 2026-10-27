import { testEnvironment, writeAgentFile } from '../../test/support/config-fixture.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { prepareAgents } from './agents.js';

/** A logger that keeps the diagnostic events, as the base logger writes them. */
function recordingLog() {
  const events: Array<Record<string, unknown> & { message?: string }> = [];
  const log = { debug: () => {}, info: () => {}, warn: () => {},
    error: (fields: Record<string, unknown>, message?: string) => { events.push({ ...fields, message }); },
    child: () => log };
  return { log, events };
}

const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(0),
  turns: [{ id: 'turn', acceptedAt: new Date(0), status: 'pending' as const, text: 'Ciao' }] };
const never = { requested: new Promise<void>(() => { /* never */ }) };

/** Consumes a reply, returning its failure or undefined. */
async function failureOf(reply: { produce(h: typeof history, c: typeof never): AsyncIterable<unknown> }): Promise<unknown> {
  try { for await (const part of reply.produce(history, never)) void part; return undefined; }
  catch (error) { return error; }
}

async function files() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-agent-composition-'));
  const llm = { provider: 'mistral', model: 'mistral-small-latest', apiKey: 'fake-key' };
  await writeAgentFile(join(directory, 'orchestrator.json'), JSON.stringify({ instructions: 'Coordinate.', llm }));
  return { directory, llm, close: () => rm(directory, { recursive: true, force: true }) };
}

// Verification: Prova della connessione asincrona dei connettori MCP
test('connects every MCP connector only when asked, once, and closes the connections in reverse order', async () => {
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
      return { listTools: async () => [{ name: 'tool', inputSchema: { type: 'object' } }],
        listPrompts: async () => [], getPrompt: async () => '',
        callTool: async () => ({ isError: false, content: [] }),
        close: async () => { closed.push(connection.url); } };
    });
    expect(agents.specialists.map((agent) => agent.id)).toEqual(['home', 'memory']);
    expect(agents.specialists.map((agent) => agent.description)).toEqual([
      'home description', 'memory description',
    ]);
    // Preparing the agents contacts no MCP server.
    expect(connected).toEqual([]);
    await Promise.all([agents.connect(), agents.connect()]);
    expect(connected).toEqual(['https://home.example/mcp', 'https://memory.example/mcp']);
    await agents.close();
    // Each connection is closed once, in reverse order of opening.
    expect(closed).toEqual([...connected].reverse());
  } finally { await fixture.close(); }
});

// Verification: Prova della selezione degli strumenti MCP
test('offers only the listed tools and leaves an agent with a missing listed tool unavailable', async () => {
  const fixture = await files();
  const discovered = ['alpha', 'light.toggle', 'beta', 'gamma'].map((name) => ({ name, inputSchema: { type: 'object' } }));
  const closed: string[] = [];
  const offered: string[][] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(await new Request(input, init).text()) as { tools?: Array<{ function: { name: string } }> };
    offered.push((body.tools ?? []).map((tool) => tool.function.name));
    return new Response('controlled failure', { status: 400 });
  });
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
    await writeAgentFile(join(fixture.directory, 'wrong.json'), JSON.stringify({ ...base,
      mcp: { url: 'https://wrong.example/mcp', auth: { type: 'bearer', token: 'secret-token' },
        tools: ['gamma', 'delta'] } }));
    const { log, events } = recordingLog();
    const agents = await prepareAgents(fixture.directory, testEnvironment(), connect, undefined, 'en', log);
    await agents.connect();
    const [all, some, wrong] = agents.specialists;
    await failureOf(all!.reply);
    await failureOf(some!.reply);
    // The tools as presented to the model: a name the provider does not accept becomes mcp_<index>.
    expect(offered).toEqual([['alpha', 'mcp_1', 'beta', 'gamma'], ['mcp_1', 'gamma']]);
    expect(await failureOf(wrong!.reply)).toMatchObject({ message: 'Agent unavailable: wrong' });
    expect(offered).toHaveLength(2);
    expect(events).toEqual([expect.objectContaining({ event: 'agent_mcp_unavailable', agent: 'wrong',
      reason: 'tool_unavailable', tool: 'delta', message: 'Agent MCP unavailable' })]);
    expect(JSON.stringify(events, (_key, value: unknown) => value instanceof Error
      ? { message: value.message, cause: value.cause } : value)).not.toMatch(/wrong\.example|secret-token/);
    expect(closed).toEqual(['https://wrong.example/mcp']);
    await agents.close();
    expect(closed).toEqual(['https://wrong.example/mcp', 'https://some.example/mcp', 'https://all.example/mcp']);
  } finally {
    vi.unstubAllGlobals();
    await fixture.close();
  }
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
        await agents.connect();
        for (const reply of [...agents.specialists.map(agent => agent.reply), agents.orchestrator]) {
          await expect((async () => { for await (const part of reply.produce(history, never)) void part; })())
            .rejects.toThrow();
        }
      } finally { await agents.close(); }
    }
    expect(systems).toHaveLength(6);
    for (const [offset, language] of [[0, 'Italian'], [3, 'English']] as const) {
      expect(systems[offset]).toContain(`Answer in ${language}.`);
      expect(systems[offset + 1]).toContain(`Weather context.\nAnswer in ${language}.`);
      expect(systems[offset + 2]).not.toContain('Answer in Italian.');
      expect(systems[offset + 2]).not.toContain('Answer in English.');
    }
    // The language leaves the orchestrator's role untouched: it receives the same instructions in both languages.
    expect(systems[5]).toBe(systems[2]);
  } finally {
    vi.unstubAllGlobals();
    await fixture.close();
  }
});

// Verification: Prova della connessione asincrona dei connettori MCP
test('a failed attempt leaves only that agent unavailable, once and without a new attempt', async () => {
  const fixture = await files();
  const closed: string[] = [];
  const attempts: string[] = [];
  const models: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    models.push(String(input));
    return new Response('controlled failure', { status: 400 });
  });
  try {
    for (const id of ['home', 'memory']) {
      await writeAgentFile(join(fixture.directory, `${id}.json`), JSON.stringify({
        description: `${id} description`, maxToolCalls: 3, instructions: 'Use tools.',
        llm: fixture.llm, mcp: { url: `https://${id}.example/mcp`, auth: { type: 'bearer', token: 'secret-token' } },
      }));
    }
    const { log, events } = recordingLog();
    const agents = await prepareAgents(fixture.directory, testEnvironment(), async (connection) => {
      attempts.push(connection.url);
      if (connection.url.includes('memory')) throw new Error('MCP unavailable');
      return { listTools: async () => [], listPrompts: async () => [], getPrompt: async () => '',
        callTool: async () => ({ isError: false, content: [] }),
        close: async () => { closed.push(connection.url); } };
    }, undefined, 'en', log);
    await agents.connect();
    const [home, memory] = agents.specialists;
    expect(await failureOf(memory!.reply)).toMatchObject({ message: 'Agent unavailable: memory' });
    expect(await failureOf(memory!.reply)).toMatchObject({ message: 'Agent unavailable: memory' });
    // The unavailable agent never calls its model; the other one does.
    expect(models).toEqual([]);
    await failureOf(home!.reply);
    expect(models).toHaveLength(1);
    expect(attempts).toEqual(['https://home.example/mcp', 'https://memory.example/mcp']);
    expect(events).toEqual([expect.objectContaining({ event: 'agent_mcp_unavailable', agent: 'memory',
      reason: 'connection_failed', message: 'Agent MCP unavailable',
      err: expect.objectContaining({ message: 'Agent MCP connection failed: memory',
        cause: expect.objectContaining({ message: 'MCP unavailable' }) }) })]);
    expect(JSON.stringify(events)).not.toMatch(/memory\.example|secret-token/);
    await agents.close();
    expect(closed).toEqual(['https://home.example/mcp']);
  } finally {
    vi.unstubAllGlobals();
    await fixture.close();
  }
});

// Verification: Prova della connessione asincrona dei connettori MCP
test('a turn given to an agent still connecting waits for the attempt', async () => {
  const fixture = await files();
  let open!: () => void;
  const opened = new Promise<void>((resolve) => { open = resolve; });
  const models: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    models.push(String(input));
    return new Response('controlled failure', { status: 400 });
  });
  try {
    await writeAgentFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm: fixture.llm,
      mcp: { url: 'https://home.example/mcp' } }));
    const agents = await prepareAgents(fixture.directory, testEnvironment(), async () => {
      await opened;
      return { listTools: async () => [], listPrompts: async () => [], getPrompt: async () => '',
        callTool: async () => ({ isError: false, content: [] }), close: async () => {} };
    });
    const connecting = agents.connect();
    const turn = failureOf(agents.specialists[0]!.reply);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(models).toEqual([]);
    open();
    await connecting;
    // The turn reaches the model once the attempt succeeded; the controlled provider then fails it.
    expect(await turn).toMatchObject({ message: expect.not.stringContaining('Agent unavailable') });
    expect(models).toHaveLength(1);
    await agents.close();
  } finally {
    vi.unstubAllGlobals();
    await fixture.close();
  }
});

// Verification: Prova della connessione asincrona dei connettori MCP
test('closing during an attempt waits for it, closes its client and leaves the agent unavailable', async () => {
  const fixture = await files();
  let open!: () => void;
  const opened = new Promise<void>((resolve) => { open = resolve; });
  const closed: string[] = [];
  try {
    await writeAgentFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm: fixture.llm,
      mcp: { url: 'https://home.example/mcp' } }));
    const agents = await prepareAgents(fixture.directory, testEnvironment(), async (connection) => {
      await opened;
      return { listTools: async () => [], listPrompts: async () => [], getPrompt: async () => '',
        callTool: async () => ({ isError: false, content: [] }),
        close: async () => { closed.push(connection.url); } };
    });
    void agents.connect();
    const closing = agents.close();
    open();
    await closing;
    expect(closed).toEqual(['https://home.example/mcp']);
    expect(await failureOf(agents.specialists[0]!.reply)).toMatchObject({ message: 'Agent unavailable: home' });
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
    expect(agents.specialists.map((agent) => agent.id)).toEqual(['generic', 'home']);
    expect(connected).toEqual([]);
    await agents.connect();
    // Only the agent with an MCP connector connects.
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
test('a prompt discovery error is a failed connection attempt of the agent', async () => {
  const fixture = await files();
  let closed = false;
  try {
    await writeAgentFile(join(fixture.directory, 'home.json'), JSON.stringify({
      description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm: fixture.llm,
      mcp: { url: 'https://home.example/mcp' } }));
    const { log, events } = recordingLog();
    const agents = await prepareAgents(fixture.directory, testEnvironment(), async () => ({ listTools: async () => [],
      listPrompts: async () => { throw new Error('MCP prompt discovery failed'); },
      getPrompt: async () => '', callTool: async () => ({ isError: false, content: [] }),
      close: async () => { closed = true; } }), undefined, 'en', log);
    await agents.connect();
    expect(events).toEqual([expect.objectContaining({ event: 'agent_mcp_unavailable', agent: 'home',
      reason: 'connection_failed', err: expect.objectContaining({ message: 'Agent MCP connection failed: home',
        cause: expect.objectContaining({ message: 'MCP prompt discovery failed' }) }) })]);
    expect(closed).toBe(true);
    await agents.close();
  } finally { await fixture.close(); }
});
