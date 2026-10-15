import { expect, test } from 'vitest';
import { MistralOrchestratorReply, MistralToolAgentReply } from '../../../src/adapters/out/mistral-function-reply.js';

const settings = { instructions: 'Use available tools when needed.', model: 'mistral-small-latest',
  apiKey: 'fake-key' };
const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(0),
  turns: [{ id: 'turn', acceptedAt: new Date(0), status: 'pending' as const, text: 'Find it' }] };

function textEvent(text: string) {
  return { data: { choices: [{ delta: { content: text } }] } };
}

function callEvent(name: string, args: object, id = 'call-1') {
  return { data: { choices: [{ delta: { toolCalls: [{ id, index: 0,
    function: { name, arguments: JSON.stringify(args) } }] } }] } };
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const result: string[] = [];
  for await (const chunk of stream) result.push(chunk);
  return result;
}

test('orchestrator streams direct text without activating a specialist', async () => {
  let delegated = false;
  const reply = new MistralOrchestratorReply(settings, [{ id: 'memory', description: 'Search memory.',
    reply: { async *produce() { delegated = true; yield 'memory'; } } }], async (request) => {
    expect(request.tools?.[0]?.function.description).toBe('Search memory.');
    return (async function* () { yield textEvent('Direct '); yield textEvent('reply'); })();
  });
  expect(await collect(reply.produce(history))).toEqual(['Direct ', 'reply']);
  expect(delegated).toBe(false);
});

test('orchestrator delegates only to the selected agent and forwards its task', async () => {
  const tasks: string[] = [];
  const reply = new MistralOrchestratorReply(settings, [
    { id: 'memory', description: 'Search memory.', reply: { async *produce(_history, task) {
      tasks.push(`memory:${task}`); yield 'found';
    } } },
    { id: 'home', description: 'Control home.', reply: { async *produce(_history, task) {
      tasks.push(`home:${task}`); yield 'home';
    } } },
  ], async () => (async function* () { yield callEvent('delegate_0', { task: 'Search notes' }); })());
  expect(await collect(reply.produce(history))).toEqual(['found']);
  expect(tasks).toEqual(['memory:Search notes']);
});

test('specialists enforce their own per-turn MCP call budgets before forwarding', async () => {
  const called: string[] = [];
  const mcp = { async callTool(name: string) { called.push(name);
    return { isError: false, content: [{ type: 'text', text: 'result' }] }; } };
  const tool = [{ name: 'lookup', description: 'Look something up',
    inputSchema: { type: 'object', properties: { key: { type: 'string' } } } }];
  const stream = () => {
    let step = 0;
    return async () => {
      const current = step++;
      return (async function* () {
        if (current < 2) yield callEvent('mcp_0', { key: `key-${current}` }, `call-${current}`);
        else yield textEvent('done');
      })();
    };
  };
  const one = new MistralToolAgentReply(settings, tool, mcp, 1, stream());
  await expect(collect(one.produce(history))).rejects.toThrow('MCP tool call limit exceeded');
  expect(called).toEqual(['lookup']);
  const two = new MistralToolAgentReply(settings, tool, mcp, 2, stream());
  expect(await collect(two.produce(history))).toEqual(['done']);
  expect(called).toEqual(['lookup', 'lookup', 'lookup']);
});

test('an unknown model-selected function never reaches the MCP server', async () => {
  let forwarded = false;
  const reply = new MistralToolAgentReply(settings, [{ name: 'lookup',
    inputSchema: { type: 'object' } }], { async callTool() {
    forwarded = true;
    return { isError: false, content: [] };
  } }, 2, async () => (async function* () {
    yield callEvent('mcp_99', {});
  })());
  await expect(collect(reply.produce(history))).rejects.toThrow('Unknown MCP tool selected by model');
  expect(forwarded).toBe(false);
});
