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
  // Verification: Prova della selezione degli strumenti MCP
  { url: 'https://example/mcp', tools: 'geocoding' },
  { url: 'https://example/mcp', tools: [] },
  { url: 'https://example/mcp', tools: ['geocoding', ''] },
  { url: 'https://example/mcp', tools: ['geocoding', 7] },
  { url: 'https://example/mcp', tools: ['geocoding', 'geocoding'] },
])('rejects invalid MCP configuration before activation: %j', async (mcp) => {
  const path = await directory();
  await writeFile(join(path, 'specialist.json'), JSON.stringify({
    description: 'Specialist.', maxToolCalls: 3, instructions: 'Use tools.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' }, mcp,
  }));
  await expect(loadAgentConfigs(path)).rejects.toThrow('Invalid agent configuration: specialist');
});

// Verification: Prova della selezione degli strumenti MCP
test('keeps the listed MCP tools and leaves them unset when the list is absent', async () => {
  const path = await directory();
  const base = { description: 'Weather.', maxToolCalls: 3, instructions: 'Use tools.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' } };
  await writeFile(join(path, 'all.json'), JSON.stringify({ ...base, mcp: { url: 'https://all.example/mcp' } }));
  await writeFile(join(path, 'some.json'), JSON.stringify({ ...base,
    mcp: { url: 'https://some.example/mcp', tools: ['weather_forecast', 'geocoding'] } }));
  const loaded = await loadAgentConfigs(path);
  expect(loaded.specialists[0]?.mcp?.tools).toBeUndefined();
  expect(loaded.specialists[1]?.mcp?.tools).toEqual(['weather_forecast', 'geocoding']);
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

// Verification: Prova delle configurazioni degli agenti con e senza MCP
test('accepts an agent without MCP and without a tool call limit next to an MCP agent', async () => {
  const path = await directory();
  const llm = { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'key-3' };
  await writeFile(join(path, 'generic.json'), JSON.stringify({
    description: 'Answers general questions.', instructions: 'Answer from knowledge.', llm }));
  await writeFile(join(path, 'home.json'), JSON.stringify({
    description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm,
    mcp: { url: 'https://home.example/mcp' } }));
  const loaded = await loadAgentConfigs(path);
  expect(loaded.specialists).toEqual([
    { id: 'generic', description: 'Answers general questions.', instructions: 'Answer from knowledge.', llm },
    { id: 'home', description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm,
      mcp: { url: 'https://home.example/mcp' } },
  ]);
});

// Verification: Prova delle configurazioni degli agenti con e senza MCP
test('rejects a tool call limit on an agent without MCP', async () => {
  const path = await directory();
  await writeFile(join(path, 'generic.json'), JSON.stringify({
    description: 'Answers general questions.', maxToolCalls: 3, instructions: 'Answer.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' } }));
  await expect(loadAgentConfigs(path)).rejects.toThrow('Invalid agent configuration: generic');
});

// Verification: Prova della selezione del modello per agente
test('accepts every supported provider and keeps each agent on its own llm', async () => {
  const path = await directory();
  const providers = {
    claude: { provider: 'anthropic', model: 'claude-model', apiKey: 'anthropic-key' },
    gemini: { provider: 'google', model: 'gemini-model', apiKey: 'google-key', options: { temperature: 0.1 } },
    gpt: { provider: 'openai', model: 'gpt-model', apiKey: 'openai-key' },
    local: { provider: 'openai-compatible', model: 'local-model', apiKey: 'local-key',
      baseURL: 'http://models.example:8080/v1' },
  };
  for (const [id, llm] of Object.entries(providers)) {
    await writeFile(join(path, `${id}.json`), JSON.stringify({
      description: `${id} agent.`, instructions: 'Answer.', llm }));
  }
  const loaded = await loadAgentConfigs(path);
  expect(loaded.orchestrator.llm).toEqual({ provider: 'mistral', model: 'mistral-small-latest', apiKey: 'key-1' });
  expect(Object.fromEntries(loaded.specialists.map((agent) => [agent.id, agent.llm]))).toEqual(providers);
});

// Verification: Prova della selezione del modello per agente
test.each([
  { provider: 'cohere', model: 'model', apiKey: 'key' },
  { provider: 'openai-compatible', model: 'model', apiKey: 'key' },
  { provider: 'openai-compatible', model: 'model', apiKey: 'key', baseURL: '' },
  { provider: 'openai-compatible', model: 'model', apiKey: 'key', baseURL: 'file:///models' },
  { provider: 'openai-compatible', model: 'model', apiKey: 'key', baseURL: 'models.example/v1' },
  { provider: 'openai', model: 'model', apiKey: 'key', baseURL: 'https://models.example/v1' },
  { provider: 'mistral', model: 'model', apiKey: 'key', baseURL: 'https://models.example/v1' },
])('rejects an unsupported provider or a misplaced endpoint: %j', async (llm) => {
  const path = await directory();
  await writeFile(join(path, 'specialist.json'), JSON.stringify({
    description: 'Specialist.', instructions: 'Answer.', llm }));
  await expect(loadAgentConfigs(path)).rejects.toThrow('Invalid agent configuration: specialist');
});

// Verification: Prova delle configurazioni degli agenti con e senza MCP
test('rejects a directory without specialist agents', async () => {
  const path = await directory();
  await expect(loadAgentConfigs(path)).rejects.toThrow('No specialist agent configured');
});
