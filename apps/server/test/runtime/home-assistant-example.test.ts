import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';

const example = new URL('../../../../examples/agents/home-assistant.json', import.meta.url);
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('the ready Home Assistant agent is accepted unchanged by the agent loader', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-home-assistant-'));
  directories.push(directory);
  await writeFile(join(directory, 'orchestrator.json'), JSON.stringify({ instructions: 'Choose.',
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: '<MISTRAL_API_KEY>' } }));
  await copyFile(example, join(directory, 'home-assistant.json'));

  const { specialists } = await loadAgentConfigs(directory);
  expect(specialists).toHaveLength(1);
  const agent = specialists[0]!;
  expect(agent.id).toBe('home-assistant');
  expect(agent.maxToolCalls).toBe(5);
  expect(agent.llm).toEqual({ provider: 'mistral', model: 'mistral-medium-latest', apiKey: '<MISTRAL_API_KEY>' });
  expect(new URL(agent.mcp!.url).pathname).toBe('/api/mcp');
  expect(agent.mcp!.auth).toEqual({ type: 'bearer', token: '<HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN>' });
  expect(agent.description).toMatch(/Home Assistant/);
  expect(agent.instructions).toMatch(/Italian/);
  expect(agent.instructions).toMatch(/only after a tool has confirmed/);
  expect(agent.instructions).toMatch(/Choose freely among the available tools/);
  expect(agent.instructions).toMatch(/do not turn on, turn off or change anything/);
  expect(agent.instructions).toMatch(/Change a device only when the user asks for a change/);
  expect(agent.instructions).toMatch(/all the lights or the lights of a room, act on all of them/);
});

test('the ready Home Assistant agent contains only placeholder credentials', async () => {
  const raw = await readFile(example, 'utf8');
  const file = JSON.parse(raw) as { llm: { apiKey: string }; mcp: { auth: { token: string } } };
  expect(file.llm.apiKey).toBe('<MISTRAL_API_KEY>');
  expect(file.mcp.auth.token).toBe('<HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN>');
  // Home Assistant tokens are JWTs; apart from the placeholders no long opaque value may appear.
  const rest = raw.replaceAll('<MISTRAL_API_KEY>', '').replaceAll('<HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN>', '');
  expect(rest).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  expect(rest).not.toMatch(/[A-Za-z0-9_-]{24,}/);
});
