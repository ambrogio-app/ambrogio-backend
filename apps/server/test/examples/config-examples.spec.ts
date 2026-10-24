// The distributed agent files are data only: they load unchanged with placeholder credentials taken
// from the environment, and they contain no secret.
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
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

// Verification: Prova dei file JSON degli agenti
test('the orchestrator and generic examples load unchanged with the credential named in the environment', async () => {
  const directory = await install('orchestrator.json', 'generic.json');
  const configured = await loadAgentConfigs(directory, placeholders);
  expect(configured.orchestrator.llm).toEqual({ provider: 'mistral', model: 'mistral-medium-latest',
    apiKey: '<MISTRAL_API_KEY>' });
  expect(configured.specialists.map(agent => [agent.id, agent.llm.apiKey]))
    .toEqual([['generic', '<MISTRAL_API_KEY>']]);
  await expect(loadAgentConfigs(directory, {})).rejects
    .toThrow('Missing environment variable MISTRAL_API_KEY for agent orchestrator');
});
