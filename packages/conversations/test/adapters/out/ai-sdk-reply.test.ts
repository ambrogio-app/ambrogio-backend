import { expect, test, vi } from 'vitest';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { ReplyPart } from '../../../src/application/produce-conversation-reply.js';
import { AiSdkOrchestratorReply, AiSdkToolAgentReply, aiSdkOptions } from '../../../src/adapters/out/ai-sdk-reply.adapter.js';

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

function answer(text: string, expectsReply = false) {
  return textParts(JSON.stringify({ answer: text, expectsReply }));
}

const text = (value: string): ReplyPart => ({ kind: 'text', text: value });
const expectation = (expectsReply: boolean): ReplyPart => ({ kind: 'reply_expectation', expectsReply });

async function collect(stream: AsyncIterable<ReplyPart>): Promise<ReplyPart[]> {
  const result: ReplyPart[] = [];
  for await (const part of stream) result.push(part);
  return result;
}

test('orchestrator streams an answer and a validated reply flag in one model call', async () => {
  const model = scripted({ parts: answer('Do you need anything else?', true), reason: 'stop' });
  const reply = new AiSdkOrchestratorReply(settings, [], model);
  expect(await collect(reply.produce(history))).toEqual([
    text('Do you need anything else?'), expectation(true),
  ]);
  expect(model.doStreamCalls).toHaveLength(1);
  expect(model.doStreamCalls[0]?.prompt).toEqual([
    { role: 'system', content: expect.stringContaining(settings.instructions) },
    { role: 'user', content: [{ type: 'text', text: 'Find it' }] },
  ]);
  expect(model.doStreamCalls[0]?.prompt[0]).toMatchObject({ role: 'system',
    content: expect.stringContaining('Set expectsReply to true') });
});

test('answer is delivered incrementally while structured output is still arriving', async () => {
  const model = scripted({ parts: [{ type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: '{"answer":"Hello' },
    { type: 'text-delta', id: 'text-1', delta: ' world","expectsReply":false}' },
    { type: 'text-end', id: 'text-1' }], reason: 'stop' });
  const reply = new AiSdkOrchestratorReply(settings, [], model);
  expect(await collect(reply.produce(history))).toEqual([
    text('Hello'), text(' world'), expectation(false),
  ]);
});

test('producer rejects a response without a boolean reply flag', async () => {
  const model = scripted({ parts: textParts('{"answer":"Question?"}'), reason: 'stop' });
  const reply = new AiSdkOrchestratorReply(settings, [], model);
  await expect(collect(reply.produce(history))).rejects.toThrow();
  expect(model.doStreamCalls).toHaveLength(1);
});

test('orchestrator delegates once to the selected specialist and takes its reply flag', async () => {
  const tasks: string[] = [];
  const model = scripted({ parts: [callPart('delegate_1', { task: 'Switch the light' })],
    reason: 'tool-calls' });
  const reply = new AiSdkOrchestratorReply(settings, [
    { id: 'memory', description: 'Search memory', reply: { async *produce() {
      throw new Error('Wrong specialist');
    } } },
    { id: 'home', description: 'Control home', reply: { async *produce(_history, task) {
      tasks.push(task ?? '');
      yield text('Which room?');
      yield expectation(true);
    } } },
  ], model);
  expect(await collect(reply.produce(history))).toEqual([text('Which room?'), expectation(true)]);
  expect(tasks).toEqual(['Switch the light']);
  expect(model.doStreamCalls).toHaveLength(1);
});

test('orchestrator rejects more than one delegation in a turn', async () => {
  const model = scripted({ parts: [callPart('delegate_0', { task: 'one' }),
    callPart('delegate_0', { task: 'two' }, 'call-2')], reason: 'tool-calls' });
  const reply = new AiSdkOrchestratorReply(settings, [{ id: 'helper', description: 'Help',
    reply: { async *produce() { yield text('unused'); yield expectation(false); } } }], model);
  await expect(collect(reply.produce(history))).rejects.toThrow('Invalid agent delegation');
});

test('specialist executes discovered MCP tools and allows a final answer at its call limit', async () => {
  const called: unknown[] = [];
  const model = scripted(
    { parts: [callPart('mcp_0', { key: 'answer' })], reason: 'tool-calls' },
    { parts: answer('Found it'), reason: 'stop' },
  );
  const reply = new AiSdkToolAgentReply(settings, [{ name: 'lookup',
    inputSchema: { type: 'object', properties: { key: { type: 'string' } },
      required: ['key'] } }], { async callTool(name, args) {
    called.push({ name, args });
    return { isError: false, content: [{ type: 'text', text: 'result' }] };
  } }, 1, model);
  expect(await collect(reply.produce(history, 'Find a fact'))).toEqual([text('Found it'), expectation(false)]);
  expect(called).toEqual([{ name: 'lookup', args: { key: 'answer' } }]);
  expect(model.doStreamCalls).toHaveLength(2);
  expect(model.doStreamCalls[0]?.prompt.at(-1)).toEqual(
    { role: 'user', content: [{ type: 'text', text: 'Find a fact' }] });
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
      model: 'mistral-small-latest', choices: [{ index: 0, delta: { content: '{"answer":"SDK answer","expectsReply":false}' },
        finish_reason: 'stop' }] };
    return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  });
  try {
    const reply = new AiSdkOrchestratorReply({ ...settings,
      options: { temperature: 0.2, max_tokens: 128 } }, []);
    expect(await collect(reply.produce(history))).toEqual([text('SDK answer'), expectation(false)]);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(seen[0]?.authorization).toBe('Bearer fake-key');
    expect(seen[0]?.body).toMatchObject({ model: 'mistral-small-latest', stream: true,
      temperature: 0.2, max_tokens: 128, response_format: { type: 'json_schema' } });
  } finally { vi.unstubAllGlobals(); }
});

test('orchestrator requests a single delegation per step from Mistral', async () => {
  const requests: Array<Record<string, unknown>> = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(JSON.parse(await request.text()) as Record<string, unknown>);
    const event = { id: 'controlled-2', object: 'chat.completion.chunk', created: 0,
      model: 'mistral-small-latest', choices: [{ index: 0,
        delta: { content: '{"answer":"Ciao","expectsReply":false}' }, finish_reason: 'stop' }] };
    return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  });
  try {
    const reply = new AiSdkOrchestratorReply(settings, [{ id: 'home', description: 'Control home',
      reply: { async *produce() { yield text('unused'); yield expectation(false); } } }]);
    expect(await collect(reply.produce(history))).toEqual([text('Ciao'), expectation(false)]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ parallel_tool_calls: false });
    expect(requests[0]!.tools).toHaveLength(1);
  } finally { vi.unstubAllGlobals(); }
});
