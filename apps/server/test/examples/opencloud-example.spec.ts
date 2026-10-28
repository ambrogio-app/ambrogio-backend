// The distributed agent files are data only: they load unchanged with placeholder credentials taken
// from the environment, and they contain no secret.
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';

const examples = new URL('../../../../examples/agents/', import.meta.url);
const placeholders = { MISTRAL_API_KEY: '<MISTRAL_API_KEY>', OPENCLOUD_MCP_TOKEN: '<OPENCLOUD_MCP_TOKEN>' };
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

// Verification: Prova della configurazione pronta di OpenCloud
test('the ready OpenCloud agent is accepted unchanged by the agent loader', async () => {
  const directory = await install('orchestrator.json', 'files.json');
  const { specialists } = await loadAgentConfigs(directory, placeholders);
  expect(specialists).toHaveLength(1);
  const agent = specialists[0]!;
  expect(agent.id).toBe('files');
  expect(agent.maxToolCalls).toBe(6);
  expect(agent.llm).toEqual({ provider: 'mistral', model: 'mistral-medium-latest', apiKey: '<MISTRAL_API_KEY>' });
  expect(new URL(agent.mcp!.url).pathname).toBe('/mcp');
  expect(agent.mcp!.auth).toEqual({ type: 'bearer', token: '<OPENCLOUD_MCP_TOKEN>' });
  expect(agent.mcp!.tools).toEqual(['search_files', 'read_file']);
  expect(agent.description).toMatch(/OpenCloud/);
  expect(agent.instructions).not.toMatch(/Italian|selected language/);
  expect(agent.instructions).toMatch(/most distinctive words of the question/);
  expect(agent.instructions).toMatch(/try again with synonyms or fewer words/);
  expect(agent.instructions).toMatch(/only the one or two files that best match/);
  expect(agent.instructions).toMatch(/with nextOffset only when the answer is not in the first part/);
  expect(agent.instructions).toMatch(/when nothing relevant is found, say so instead of guessing/);
  expect(agent.instructions).toMatch(/end with a Markdown link to each document you used/);
  await expect(loadAgentConfigs(directory, { MISTRAL_API_KEY: '<MISTRAL_API_KEY>' })).rejects
    .toThrow('Missing environment variable OPENCLOUD_MCP_TOKEN for agent files');
  expect(await readFile(new URL('files.json', examples), 'utf8'))
    .toContain('"tokenEnv": "OPENCLOUD_MCP_TOKEN"');
});
