import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
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
    })).rejects.toThrow('Unsupported Mistral option');
    expect(connected).toBe(false);
  } finally { await fixture.close(); }
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
      return { listTools: async () => [], callTool: async () => ({ isError: false, content: [] }),
        close: async () => { closed.push(connection.url); } };
    })).rejects.toThrow('MCP unavailable');
    expect(closed).toEqual(['https://home.example/mcp']);
  } finally { await fixture.close(); }
});
