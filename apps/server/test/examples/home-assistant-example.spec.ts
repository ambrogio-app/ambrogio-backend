import { writeConfigFile } from '../support/config-fixture.js';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';

const example = new URL('../../../../examples/agents/home-assistant.ts', import.meta.url);
const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test('the ready Home Assistant agent is accepted unchanged by the agent loader', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-home-assistant-'));
  directories.push(directory);
  await writeConfigFile(join(directory, 'orchestrator.ts'), JSON.stringify({ instructions: 'Choose.',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: '<MISTRAL_API_KEY>' } }));
  await copyFile(example, join(directory, 'home-assistant.ts'));
  vi.stubEnv('MISTRAL_API_KEY', '<MISTRAL_API_KEY>');
  vi.stubEnv('HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN', '<HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN>');
  vi.stubEnv('AMBROGIO_HOME_ASSISTANT_MCP_URL', 'https://home-assistant.example.test/api/mcp');

  const { specialists } = await loadAgentConfigs(directory);
  expect(specialists).toHaveLength(1);
  const agent = specialists[0]!;
  expect(agent.id).toBe('home-assistant');
  expect(agent.maxToolCalls).toBe(5);
  expect(agent.llm).toEqual({ provider: 'mistral', model: 'mistral-medium-latest', apiKey: '<MISTRAL_API_KEY>' });
  expect(new URL(agent.mcp!.url).pathname).toBe('/api/mcp');
  expect(agent.mcp!.auth).toEqual({ type: 'bearer', token: '<HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN>' });
  expect(agent.description).toMatch(/Home Assistant/);
  expect(agent.instructions).toMatch(/^You control the family's home through Home Assistant. Answer briefly./);
  expect(agent.instructions).not.toMatch(/Italian/);
  expect(agent.instructions).toMatch(/only after a tool has confirmed/);
  expect(agent.instructions).toMatch(/Choose freely among the available tools/);
  expect(agent.instructions).toMatch(/do not turn on, turn off or change anything/);
  expect(agent.instructions).toMatch(/Change a device only when the user asks for a change/);
  expect(agent.instructions).toMatch(/all the lights or the lights of a room, act on all of them/);
});

test('the ready Home Assistant agent contains only placeholder credentials', async () => {
  const raw = await readFile(example, 'utf8');
  expect(raw).toContain('process.env.MISTRAL_API_KEY');
  expect(raw).toContain('process.env.HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN');
  expect(raw).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
});
