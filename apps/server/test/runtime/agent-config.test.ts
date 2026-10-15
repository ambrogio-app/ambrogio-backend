import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'ambrogio-agents-'));
  directories.push(path);
  await writeFile(join(path, 'orchestrator.json'), JSON.stringify({
    instructions: 'Coordinate.', llm: { provider: 'mistral', model: 'mistral-small-latest', apiKey: 'key-1' },
  }));
  return path;
}

test('discovers each agent and accepts distinct Bearer, OAuth, and unauthenticated MCP configurations', async () => {
  const path = await directory();
  const base = { description: 'Answer questions using this service.', maxToolCalls: 3,
    instructions: 'Use tools.', llm: {
    provider: 'mistral', model: 'mistral-small-latest', apiKey: 'key-2',
  } };
  await writeFile(join(path, 'home.json'), JSON.stringify({ ...base,
    mcp: { url: 'https://home.example/mcp', auth: { type: 'bearer', token: 'home-token' } } }));
  await writeFile(join(path, 'memory.json'), JSON.stringify({ ...base,
    mcp: { url: 'http://memory.example/mcp' } }));
  await writeFile(join(path, 'search.json'), JSON.stringify({ ...base,
    mcp: { url: 'https://search.example/mcp', auth: { type: 'oauth_client_credentials',
      clientId: 'ambrogio', clientSecret: 'search-secret', issuer: 'https://auth.example', scope: 'read' } } }));
  const loaded = await loadAgentConfigs(path);
  expect(loaded.orchestrator.id).toBe('orchestrator');
  expect(loaded.specialists.map((agent) => agent.id)).toEqual(['home', 'memory', 'search']);
  expect(loaded.specialists.map((agent) => agent.description)).toEqual([
    base.description, base.description, base.description,
  ]);
  expect(loaded.specialists.map((agent) => agent.maxToolCalls)).toEqual([3, 3, 3]);
  expect(loaded.specialists[0]?.mcp?.auth).toEqual({ type: 'bearer', token: 'home-token' });
  expect(loaded.specialists[1]?.mcp?.auth).toBeUndefined();
  expect(loaded.specialists[2]?.mcp?.auth).toMatchObject({ type: 'oauth_client_credentials', scope: 'read' });
});

test.each([
  { url: 'file:///tmp/mcp' },
  { url: 'https://example/mcp', transport: 'stdio' },
  { url: 'https://example/mcp', auth: { type: 'bearer', token: '' } },
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: 'id', clientSecret: 'secret', issuer: 'https://other.example', scope: '' } },
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: 'id', clientSecret: 'secret', issuer: 'not-an-issuer' } },
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: '', clientSecret: 'secret', issuer: 'https://auth.example' } },
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: 'id', clientSecret: '', issuer: 'https://auth.example' } },
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: 'id', clientSecret: 'secret' } },
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: 'id', clientSecret: 'secret', issuer: '' } },
])('rejects invalid MCP configuration before activation: %j', async (mcp) => {
  const path = await directory();
  await writeFile(join(path, 'specialist.json'), JSON.stringify({
    description: 'Specialist.', maxToolCalls: 3, instructions: 'Use tools.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' }, mcp,
  }));
  await expect(loadAgentConfigs(path)).rejects.toThrow('Invalid agent configuration: specialist');
});

test.each([undefined, '', 42])('rejects invalid specialist description: %j', async (description) => {
  const path = await directory();
  await writeFile(join(path, 'specialist.json'), JSON.stringify({
    description, maxToolCalls: 3, instructions: 'Use tools.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' },
    mcp: { url: 'https://example.com/mcp' },
  }));
  await expect(loadAgentConfigs(path)).rejects.toThrow('Invalid agent configuration: specialist');
});

test.each([undefined, 0, -1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid specialist tool call limit: %j', async (maxToolCalls) => {
    const path = await directory();
    await writeFile(join(path, 'specialist.json'), JSON.stringify({
      description: 'Specialist.', maxToolCalls, instructions: 'Use tools.',
      llm: { provider: 'mistral', model: 'model', apiKey: 'key' },
      mcp: { url: 'https://example.com/mcp' },
    }));
    await expect(loadAgentConfigs(path)).rejects.toThrow('Invalid agent configuration: specialist');
  },
);
