import { testEnvironment, writeAgentFile } from '../../test/support/config-fixture.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadAgentConfigs, readAgentsDirectory } from './agent-config.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'ambrogio-agents-'));
  directories.push(path);
  await writeAgentFile(join(path, 'orchestrator.json'), JSON.stringify({
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
  await writeAgentFile(join(path, 'home.json'), JSON.stringify({ ...base,
    mcp: { url: 'https://home.example/mcp', auth: { type: 'bearer', token: 'home-token' } } }));
  await writeAgentFile(join(path, 'memory.json'), JSON.stringify({ ...base,
    mcp: { url: 'http://memory.example/mcp' } }));
  await writeAgentFile(join(path, 'search.json'), JSON.stringify({ ...base,
    mcp: { url: 'https://search.example/mcp', auth: { type: 'oauth_client_credentials',
      clientId: 'ambrogio', clientSecret: 'search-secret', issuer: 'https://auth.example', scope: 'read' } } }));
  const loaded = await loadAgentConfigs(path, testEnvironment());
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
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: 'id', clientSecret: 'secret', issuer: 'https://other.example', scope: '' } },
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: 'id', clientSecret: 'secret', issuer: 'not-an-issuer' } },
  { url: 'https://example/mcp', auth: { type: 'oauth_client_credentials',
    clientId: '', clientSecret: 'secret', issuer: 'https://auth.example' } },
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
  await writeAgentFile(join(path, 'specialist.json'), JSON.stringify({
    description: 'Specialist.', maxToolCalls: 3, instructions: 'Use tools.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' }, mcp,
  }));
  await expect(loadAgentConfigs(path, testEnvironment())).rejects.toThrow('Invalid agent configuration: specialist');
});

// Verification: Prova della selezione degli strumenti MCP
test('keeps the listed MCP tools and leaves them unset when the list is absent', async () => {
  const path = await directory();
  const base = { description: 'Weather.', maxToolCalls: 3, instructions: 'Use tools.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' } };
  await writeAgentFile(join(path, 'all.json'), JSON.stringify({ ...base, mcp: { url: 'https://all.example/mcp' } }));
  await writeAgentFile(join(path, 'some.json'), JSON.stringify({ ...base,
    mcp: { url: 'https://some.example/mcp', tools: ['weather_forecast', 'geocoding'] } }));
  const loaded = await loadAgentConfigs(path, testEnvironment());
  expect(loaded.specialists[0]?.mcp?.tools).toBeUndefined();
  expect(loaded.specialists[1]?.mcp?.tools).toEqual(['weather_forecast', 'geocoding']);
});

test.each([undefined, '', 42])('rejects invalid specialist description: %j', async (description) => {
  const path = await directory();
  await writeAgentFile(join(path, 'specialist.json'), JSON.stringify({
    description, maxToolCalls: 3, instructions: 'Use tools.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' },
    mcp: { url: 'https://example.com/mcp' },
  }));
  await expect(loadAgentConfigs(path, testEnvironment())).rejects.toThrow('Invalid agent configuration: specialist');
});

test.each([undefined, 0, -1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid specialist tool call limit: %j', async (maxToolCalls) => {
    const path = await directory();
    await writeAgentFile(join(path, 'specialist.json'), JSON.stringify({
      description: 'Specialist.', maxToolCalls, instructions: 'Use tools.',
      llm: { provider: 'mistral', model: 'model', apiKey: 'key' },
      mcp: { url: 'https://example.com/mcp' },
    }));
    await expect(loadAgentConfigs(path, testEnvironment())).rejects.toThrow('Invalid agent configuration: specialist');
  },
);

// Verification: Prova delle configurazioni degli agenti con e senza MCP
test('accepts an agent without MCP and without a tool call limit next to an MCP agent', async () => {
  const path = await directory();
  const llm = { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'key-3' };
  await writeAgentFile(join(path, 'generic.json'), JSON.stringify({
    description: 'Answers general questions.', instructions: 'Answer from knowledge.', llm }));
  await writeAgentFile(join(path, 'home.json'), JSON.stringify({
    description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm,
    mcp: { url: 'https://home.example/mcp' } }));
  const loaded = await loadAgentConfigs(path, testEnvironment());
  expect(loaded.specialists).toEqual([
    { id: 'generic', description: 'Answers general questions.', instructions: 'Answer from knowledge.', llm },
    { id: 'home', description: 'Controls the home.', maxToolCalls: 2, instructions: 'Use tools.', llm,
      mcp: { url: 'https://home.example/mcp' } },
  ]);
});

// Verification: Prova delle configurazioni degli agenti con e senza MCP
test('rejects a tool call limit on an agent without MCP', async () => {
  const path = await directory();
  await writeAgentFile(join(path, 'generic.json'), JSON.stringify({
    description: 'Answers general questions.', maxToolCalls: 3, instructions: 'Answer.',
    llm: { provider: 'mistral', model: 'model', apiKey: 'key' } }));
  await expect(loadAgentConfigs(path, testEnvironment())).rejects.toThrow('Invalid agent configuration: generic');
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
    await writeAgentFile(join(path, `${id}.json`), JSON.stringify({
      description: `${id} agent.`, instructions: 'Answer.', llm }));
  }
  const loaded = await loadAgentConfigs(path, testEnvironment());
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
  await writeAgentFile(join(path, 'specialist.json'), JSON.stringify({
    description: 'Specialist.', instructions: 'Answer.', llm }));
  await expect(loadAgentConfigs(path, testEnvironment())).rejects.toThrow('Invalid agent configuration: specialist');
});

// Verification: Prova delle configurazioni degli agenti con e senza MCP
test('rejects a directory without specialist agents', async () => {
  const path = await directory();
  await expect(loadAgentConfigs(path, testEnvironment())).rejects.toThrow('No specialist agent configured');
});

const marker = 'marker-secret-4f2a9c';
const plainFile = (path: string, id: string, value: unknown) =>
  writeFile(join(path, `${id}.json`), JSON.stringify(value));
const specialist = (llm: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  description: 'Specialist.', instructions: 'Answer.', llm, ...extra });

// Verification: Prova dei file JSON degli agenti
test('reads data-only JSON files, reserves orchestrator.json and ignores files of other kinds', async () => {
  const path = await directory();
  await plainFile(path, 'helper', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'HELPER_KEY' }));
  await writeFile(join(path, 'legacy.ts'), 'export default {};\n');
  await writeFile(join(path, 'notes.txt'), 'not an agent');
  await mkdir(join(path, 'drafts'));
  const loaded = await loadAgentConfigs(path, testEnvironment({ HELPER_KEY: 'helper-key' }));
  expect(loaded.orchestrator.id).toBe('orchestrator');
  expect(loaded.specialists.map(agent => agent.id)).toEqual(['helper']);
  expect(loaded.specialists[0]?.llm.apiKey).toBe('helper-key');
  await rm(join(path, 'orchestrator.json'));
  await expect(loadAgentConfigs(path, testEnvironment({ HELPER_KEY: 'helper-key' })))
    .rejects.toThrow('Missing orchestrator configuration');
});

// Verification: Prova dei file JSON degli agenti
test('rejects a file that is not valid JSON', async () => {
  const path = await directory();
  await writeFile(join(path, 'broken.json'), '{ "description": ');
  await expect(loadAgentConfigs(path, testEnvironment())).rejects.toThrow('Invalid agent configuration: broken');
});

// Verification: Prova dei file JSON degli agenti
test.each([
  ['a literal API key', specialist({ provider: 'mistral', model: 'model', apiKey: marker })],
  ['a literal Bearer token', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'HELPER_KEY' }, {
    maxToolCalls: 2, mcp: { url: 'https://example.com/mcp', auth: { type: 'bearer', token: marker } } })],
  ['a literal OAuth client secret', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'HELPER_KEY' }, {
    maxToolCalls: 2, mcp: { url: 'https://example.com/mcp', auth: { type: 'oauth_client_credentials',
      clientId: 'ambrogio', clientSecret: marker, issuer: 'https://auth.example' } } })],
  ['an unknown top-level field', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'HELPER_KEY' },
    { enabled: true })],
  ['an unknown llm field', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'HELPER_KEY', region: 'eu' })],
  ['an unknown mcp field', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'HELPER_KEY' }, {
    maxToolCalls: 2, mcp: { url: 'https://example.com/mcp', transport: 'stdio' } })],
  ['an invalid variable name', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'helper-key' })],
  ['a variable name that is not a string', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 7 })],
  ['no API key variable', specialist({ provider: 'mistral', model: 'model' })],
])('rejects %s without showing any value', async (_case, value) => {
  const path = await directory();
  await plainFile(path, 'helper', value);
  const failure = loadAgentConfigs(path, testEnvironment({ HELPER_KEY: marker }));
  await expect(failure).rejects.toThrow('Invalid agent configuration: helper');
  const error = await failure.then(() => undefined, (caught: Error) => caught);
  expect(error?.message).not.toContain(marker);
});

// Verification: Prova dei file JSON degli agenti
test.each([
  ['the API key', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'HELPER_KEY' }), 'HELPER_KEY'],
  ['the Bearer token', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'PRESENT_KEY' }, {
    maxToolCalls: 2, mcp: { url: 'https://example.com/mcp', auth: { type: 'bearer', tokenEnv: 'HELPER_TOKEN' } } }),
  'HELPER_TOKEN'],
  ['the OAuth client secret', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'PRESENT_KEY' }, {
    maxToolCalls: 2, mcp: { url: 'https://example.com/mcp', auth: { type: 'oauth_client_credentials',
      clientId: 'ambrogio', clientSecretEnv: 'HELPER_SECRET', issuer: 'https://auth.example' } } }),
  'HELPER_SECRET'],
])('names the variable when %s is absent or empty', async (_case, value, name) => {
  const path = await directory();
  await plainFile(path, 'helper', value);
  const message = `Missing environment variable ${name} for agent helper`;
  await expect(loadAgentConfigs(path, testEnvironment({ PRESENT_KEY: marker }))).rejects.toThrow(message);
  await expect(loadAgentConfigs(path, testEnvironment({ PRESENT_KEY: marker, [name]: '' }))).rejects.toThrow(message);
});

// Verification: Prova dell'origine delle credenziali API
test('reads every credential from the variable its file names', async () => {
  const path = await directory();
  await plainFile(path, 'home', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'HOME_KEY' }, {
    maxToolCalls: 2, mcp: { url: 'https://home.example/mcp', auth: { type: 'bearer', tokenEnv: 'HOME_TOKEN' } } }));
  await plainFile(path, 'search', specialist({ provider: 'mistral', model: 'model', apiKeyEnv: 'SEARCH_KEY' }, {
    maxToolCalls: 2, mcp: { url: 'https://search.example/mcp', auth: { type: 'oauth_client_credentials',
      clientId: 'ambrogio', clientSecretEnv: 'SEARCH_SECRET', issuer: 'https://auth.example', scope: 'read' } } }));
  const loaded = await loadAgentConfigs(path, testEnvironment({ HOME_KEY: 'home-key', HOME_TOKEN: 'home-token',
    SEARCH_KEY: 'search-key', SEARCH_SECRET: 'search-secret' }));
  const [home, search] = loaded.specialists;
  expect(home?.llm.apiKey).toBe('home-key');
  expect(home?.mcp?.auth).toEqual({ type: 'bearer', token: 'home-token' });
  expect(search?.llm.apiKey).toBe('search-key');
  expect(search?.mcp?.auth).toEqual({ type: 'oauth_client_credentials', clientId: 'ambrogio',
    clientSecret: 'search-secret', issuer: 'https://auth.example', scope: 'read' });
});

// Verification: Prova dei file JSON degli agenti
test('reads the agent directory from AMBROGIO_AGENTS_DIR, by default the directory of the image', () => {
  expect(readAgentsDirectory({}, 'production')).toBe('/etc/ambrogio/agents');
  expect(readAgentsDirectory({ AMBROGIO_AGENTS_DIR: '' }, 'development')).toBe('/etc/ambrogio/agents');
  expect(readAgentsDirectory({ AMBROGIO_AGENTS_DIR: '/srv/agents' }, 'test')).toBe('/srv/agents');
});
