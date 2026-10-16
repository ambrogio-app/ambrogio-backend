import { expect, test, vi } from 'vitest';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { AiSdkOrchestratorReply, AiSdkToolAgentReply, aiSdkOptions } from '../../../src/adapters/out/ai-sdk-reply.js';

const settings = { instructions: 'Use available tools when needed.', model: 'mistral-small-latest',
  apiKey: 'fake-key' };
const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(0),
  turns: [{ id: 'turn', acceptedAt: new Date(0), status: 'pending' as const, text: 'Find it' }] };
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined } };

function scripted(...steps: Array<{ parts: object[]; reason: 'stop' | 'tool-calls' }>) {
  let next = 0;
  return new MockLanguageModelV4({ doStream: async () => {
    const step = steps[next++];
    if (!step) throw new Error('Unexpected model step');
    return { stream: simulateReadableStream({ chunks: [...step.parts, { type: 'finish',
      finishReason: { unified: step.reason, raw: undefined }, usage }] as any[] }) };
  } });
}

function textParts(text: string) {
  return [{ type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' }];
}

function callPart(name: string, input: object, id = 'call-1') {
  return { type: 'tool-call', toolCallId: id, toolName: name, input: JSON.stringify(input) };
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const result: string[] = [];
  for await (const chunk of stream) result.push(chunk);
  return result;
}

test('orchestrator streams a direct reply with instructions and persisted history', async () => {
  const model = scripted({ parts: textParts('Direct reply'), reason: 'stop' });
  const reply = new AiSdkOrchestratorReply(settings, [], model);
  expect(await collect(reply.produce(history))).toEqual(['Direct reply']);
  expect(model.doStreamCalls).toHaveLength(1);
  expect(model.doStreamCalls[0]?.prompt).toEqual([
    { role: 'system', content: settings.instructions },
    { role: 'user', content: [{ type: 'text', text: 'Find it' }] },
  ]);
});

test('orchestrator delegates once to the selected specialist', async () => {
  const tasks: string[] = [];
  const model = scripted({ parts: [callPart('delegate_1', { task: 'Switch the light' })],
    reason: 'tool-calls' });
  const reply = new AiSdkOrchestratorReply(settings, [
    { id: 'memory', description: 'Search memory', reply: { async *produce() {
      throw new Error('Wrong specialist');
    } } },
    { id: 'home', description: 'Control home', reply: { async *produce(_history, task) {
      tasks.push(task ?? ''); yield 'done';
    } } },
  ], model);
  expect(await collect(reply.produce(history))).toEqual(['done']);
  expect(tasks).toEqual(['Switch the light']);
});

test('specialist executes discovered MCP tools and allows a final answer at its call limit', async () => {
  const called: unknown[] = [];
  const model = scripted(
    { parts: [callPart('mcp_0', { key: 'answer' })], reason: 'tool-calls' },
    { parts: textParts('Found it'), reason: 'stop' },
  );
  const reply = new AiSdkToolAgentReply(settings, [{ name: 'lookup',
    inputSchema: { type: 'object', properties: { key: { type: 'string' } },
      required: ['key'] } }], { async callTool(name, args) {
    called.push({ name, args });
    return { isError: false, content: [{ type: 'text', text: 'result' }] };
  } }, 1, model);
  expect(await collect(reply.produce(history, 'Find a fact'))).toEqual(['Found it']);
  expect(called).toEqual([{ name: 'lookup', args: { key: 'answer' } }]);
  expect(model.doStreamCalls).toHaveLength(2);
});

test('specialist refuses the first MCP call beyond its per-turn limit', async () => {
  const called: string[] = [];
  const model = scripted(
    { parts: [callPart('mcp_0', {})], reason: 'tool-calls' },
    { parts: [callPart('mcp_0', {}, 'call-2')], reason: 'tool-calls' },
  );
  const reply = new AiSdkToolAgentReply(settings, [{ name: 'lookup',
    inputSchema: { type: 'object' } }], { async callTool(name) {
    called.push(name); return { isError: false, content: [] };
  } }, 1, model);
  await expect(collect(reply.produce(history))).rejects.toThrow('MCP tool call limit exceeded');
  expect(called).toEqual(['lookup']);
});

test('provider options remain validated and map to AI SDK settings', () => {
  expect(aiSdkOptions({ temperature: 0.2, max_tokens: 128 })).toEqual({
    temperature: 0.2, maxOutputTokens: 128 });
  expect(aiSdkOptions()).toEqual({});
  expect(() => aiSdkOptions({ top_p: 0.2 })).toThrow('Unsupported Mistral option');
  expect(() => aiSdkOptions({ temperature: -1 })).toThrow('Invalid Mistral temperature');
  expect(() => aiSdkOptions({ max_tokens: 0 })).toThrow('Invalid Mistral max_tokens');
});

test('AI SDK Mistral provider sends the selected model and key to its default endpoint', async () => {
  const seen: Array<{ url: string; authorization: string | null; body: unknown }> = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({ url: request.url, authorization: request.headers.get('authorization'),
      body: JSON.parse(await request.text()) as unknown });
    const event = { id: 'controlled-1', object: 'chat.completion.chunk', created: 0,
      model: 'mistral-small-latest', choices: [{ index: 0, delta: { content: 'SDK answer' },
        finish_reason: 'stop' }] };
    return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  });
  try {
    const reply = new AiSdkOrchestratorReply({ ...settings,
      options: { temperature: 0.2, max_tokens: 128 } }, []);
    expect(await collect(reply.produce(history))).toEqual(['SDK answer']);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(seen[0]?.authorization).toBe('Bearer fake-key');
    expect(seen[0]?.body).toMatchObject({ model: 'mistral-small-latest', stream: true,
      temperature: 0.2, max_tokens: 128 });
  } finally { vi.unstubAllGlobals(); }
});
