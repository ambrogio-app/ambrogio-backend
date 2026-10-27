// The example agent of the Memory connector («Agente Memory d'esempio nel repository»).
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadAgentConfigs } from '../../src/runtime/agent-config.js';

const examples = new URL('../../../../examples/agents/', import.meta.url);
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

// Verification: Prova dell'agente Memory d'esempio
test('the memory example loads unchanged and connects to the memory MCP server of its own backend', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-memory-example-'));
  directories.push(directory);
  for (const name of ['orchestrator.json', 'memory.json']) await copyFile(new URL(name, examples), join(directory, name));
  const { specialists } = await loadAgentConfigs(directory, { MISTRAL_API_KEY: '<MISTRAL_API_KEY>' });
  expect(specialists).toHaveLength(1);
  const [memory] = specialists;
  expect(memory).toMatchObject({ id: 'memory', maxToolCalls: 4,
    description: "Searches the family's past conversations to answer questions about what was said before.",
    llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: '<MISTRAL_API_KEY>' },
    mcp: { url: 'http://127.0.0.1:3000/mcp/memory', tools: ['search_conversations'] } });
  expect(memory!.mcp).not.toHaveProperty('auth');
  const instructions = memory!.instructions;
  expect(instructions).toContain('call search_conversations');
  expect(instructions).toContain('try again with synonyms or more general words');
  expect(instructions).toContain('say so instead of guessing');
  expect(instructions).toContain('mention the date');
  const raw = await readFile(new URL('memory.json', examples), 'utf8');
  expect(raw).not.toMatch(/"(apiKey|token|clientSecret)"/);
});
