// The distributed agent files are data only: they load unchanged with placeholder credentials taken
// from the environment, and they contain no secret.
import { copyFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';

const examples = new URL('../../../../examples/agents/', import.meta.url);
const placeholders = { MISTRAL_API_KEY: '<MISTRAL_API_KEY>',
  HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN: '<HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN>' };
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function install(...names: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-agent-examples-'));
  directories.push(directory);
  for (const name of names) await copyFile(new URL(name, examples), join(directory, name));
  return directory;
}

// Verification: Prova della configurazione pronta di Home Assistant
test('the ready Home Assistant agent is accepted unchanged by the agent loader', async () => {
  const directory = await install('orchestrator.json', 'home-assistant.json');
  const { specialists } = await loadAgentConfigs(directory, placeholders);
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
  await expect(loadAgentConfigs(directory, { MISTRAL_API_KEY: '<MISTRAL_API_KEY>' })).rejects
    .toThrow('Missing environment variable HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN for agent home-assistant');
});

// Verification: Controllo degli esempi di configurazione
test('the agent examples name their credentials and contain none', async () => {
  for (const name of await readdir(examples)) {
    const raw = await readFile(new URL(name, examples), 'utf8');
    expect(name).toMatch(/\.json$/);
    expect(raw).not.toMatch(/"(apiKey|token|clientSecret)"/);
    expect(raw).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(raw).toContain('"apiKeyEnv": "MISTRAL_API_KEY"');
  }
  expect(await readFile(new URL('home-assistant.json', examples), 'utf8'))
    .toContain('"tokenEnv": "HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN"');
});
