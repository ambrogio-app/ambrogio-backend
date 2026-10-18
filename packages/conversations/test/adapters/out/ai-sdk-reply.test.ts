import { expect, test, vi } from 'vitest';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { ReplyPart } from '../../../src/application/produce-conversation-reply.js';
import { ProjectError } from '../../../src/project-error.js';
import { AiSdkKnowledgeAgentReply, AiSdkOrchestratorReply, AiSdkToolAgentReply, aiSdkOptions } from '../../../src/adapters/out/ai-sdk-reply.adapter.js';

const settings = { provider: 'mistral' as const, instructions: 'Use available tools when needed.',
  model: 'mistral-small-latest', apiKey: 'fake-key' };
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

/** A server without prompts never has them read. */
const getPrompt = async (): Promise<string> => { throw new Error('Unexpected prompt read'); };
const text = (value: string): ReplyPart => ({ kind: 'text', text: value });
/** A cancellation that is never requested. */
const never = () => ({ requested: new Promise<void>(() => { /* never */ }) });
const expectation = (expectsReply: boolean): ReplyPart => ({ kind: 'reply_expectation', expectsReply });

async function collect(stream: AsyncIterable<ReplyPart>): Promise<ReplyPart[]> {
  const result: ReplyPart[] = [];
  for await (const part of stream) result.push(part);
  return result;
}

function chooser(...outputs: string[]) {
  let next = 0;
  return new MockLanguageModelV4({ doGenerate: async () => {
    const output = outputs[next++];
    if (output === undefined) throw new Error('Unexpected router call');
    return { content: [{ type: 'text', text: output }], warnings: [],
      finishReason: { unified: 'stop', raw: undefined }, usage } as any;
  } });
}

function recordingAgent(id: string, description: string, parts: ReplyPart[], received: unknown[] = []) {
  return { id, description, reply: { async *produce(...args: unknown[]) {
    received.push(args);
    yield* parts;
  } } };
}

// Verification: Prova della scelta dell'agente da parte dell'orchestratore
test('orchestrator only chooses the agent with structured output and the agent answers', async () => {
  const received: unknown[] = [];
  const model = chooser('{"agent":"home"}');
  const stop = never();
  const reply = new AiSdkOrchestratorReply(settings, [
    recordingAgent('memory', 'Search memory', [text('wrong')]),
    recordingAgent('home', 'Control home', [text('Which room?'), expectation(true)], received),
  ], model);
  expect(await collect(reply.produce(history, stop))).toEqual([
    { kind: 'agent', agent: 'home' }, text('Which room?'), expectation(true)]);
  // The chosen agent gets the stored history with the original text, no task, and the same cancellation.
  expect(received).toHaveLength(1);
  expect((received[0] as unknown[])[0]).toBe(history);
  expect((received[0] as unknown[])[1]).toBe(stop);
  expect(model.doGenerateCalls).toHaveLength(1);
  const call = model.doGenerateCalls[0]!;
  expect(call.tools ?? []).toEqual([]);
  expect(call.responseFormat).toMatchObject({ type: 'json', schema: { type: 'object',
    properties: { agent: { type: 'string', enum: ['memory', 'home'] } },
    required: ['agent'], additionalProperties: false } });
  expect(call.prompt[0]).toMatchObject({ role: 'system',
    content: expect.stringContaining(settings.instructions) });
  const system = String(call.prompt[0]?.content);
  expect(system).toContain('- memory: Search memory');
  expect(system).toContain('- home: Control home');
  expect(call.prompt.at(-1)).toEqual({ role: 'user', content: [{ type: 'text', text: 'Find it' }] });
});

// Verification: Prova della scelta dell'agente da parte dell'orchestratore
test.each(['{"agent":"home_assistant"}', '{}', 'home', '{"agent":"home","answer":"Fatto"}'])(
  'an invalid choice fails the reply without activating any agent: %s', async (output) => {
    const received: unknown[] = [];
    const reply = new AiSdkOrchestratorReply(settings, [
      recordingAgent('home', 'Control home', [text('unused'), expectation(false)], received),
    ], chooser(output));
    await expect(collect(reply.produce(history, never()))).rejects.toThrow();
    expect(received).toEqual([]);
  });

// Verification: Prova della continuità dell'agente nella conversazione
test('the router sees which agent gave each previous answer; the agents do not', async () => {
  const conversation = { ...history, turns: [
    { id: 'first', acceptedAt: new Date(0), status: 'answered' as const, text: 'Accendi la luce',
      answer: 'Quale stanza?', finishedAt: new Date(1), agent: 'home' },
    { id: 'older', acceptedAt: new Date(2), status: 'answered' as const, text: 'Ciao',
      answer: 'Ciao!', finishedAt: new Date(3) },
    { id: 'turn', acceptedAt: new Date(4), status: 'pending' as const, text: 'camera' },
  ] };
  const router = chooser('{"agent":"home"}');
  const agentModel = scripted({ parts: answer('Fatto.'), reason: 'stop' });
  const home = new AiSdkToolAgentReply(settings, { tools: [], prompts: [] }, { getPrompt, async callTool() {
    return { isError: false, content: [] };
  } }, 1, agentModel);
  const reply = new AiSdkOrchestratorReply(settings, [{ id: 'home', description: 'Control home', reply: home }], router);
  expect(await collect(reply.produce(conversation, never()))).toEqual([
    { kind: 'agent', agent: 'home' }, text('Fatto.'), expectation(false)]);
  expect(router.doGenerateCalls[0]?.prompt.slice(1)).toEqual([
    { role: 'user', content: [{ type: 'text', text: 'Accendi la luce' }] },
    { role: 'assistant', content: [{ type: 'text', text: '[agent: home] Quale stanza?' }] },
    { role: 'user', content: [{ type: 'text', text: 'Ciao' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'Ciao!' }] },
    { role: 'user', content: [{ type: 'text', text: 'camera' }] },
  ]);
  expect(agentModel.doStreamCalls[0]?.prompt.slice(1, 3)).toEqual([
    { role: 'user', content: [{ type: 'text', text: 'Accendi la luce' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'Quale stanza?' }] },
  ]);
});

// Verification: Prova dell'agente specializzato senza connettore MCP
test('an agent without MCP answers with its own instructions and no tools', async () => {
  const model = scripted({ parts: answer('Nel 1492.'), reason: 'stop' });
  const reply = new AiSdkKnowledgeAgentReply({ ...settings, instructions: 'Answer from knowledge.' }, model);
  expect(await collect(reply.produce(history, never())))
    .toEqual([text('Nel 1492.'), expectation(false)]);
  expect(model.doStreamCalls).toHaveLength(1);
  expect(model.doStreamCalls[0]?.tools ?? []).toEqual([]);
  expect(model.doStreamCalls[0]?.prompt).toEqual([
    { role: 'system', content: expect.stringContaining('Answer from knowledge.') },
    { role: 'user', content: [{ type: 'text', text: 'Find it' }] },
  ]);
  expect(model.doStreamCalls[0]?.prompt[0]).toMatchObject({
    content: expect.stringContaining('Set expectsReply to true') });
});

// Verification: Prova del tempo massimo della produzione della risposta
test('the cancellation aborts the router, the agent model and the MCP invocation', async () => {
  let request!: () => void;
  const stop = { requested: new Promise<void>(resolve => { request = resolve; }) };
  const router = chooser('{"agent":"home"}');
  const agentModel = scripted(
    { parts: [callPart('lookup', { key: 'answer' })], reason: 'tool-calls' },
    { parts: answer('Found it'), reason: 'stop' },
  );
  const toolSignals: Array<AbortSignal | undefined> = [];
  const home = new AiSdkToolAgentReply(settings, { prompts: [], tools: [{ name: 'lookup',
    inputSchema: { type: 'object' } }] }, { getPrompt, async callTool(_name, _args, signal) {
    toolSignals.push(signal);
    return { isError: false, content: [{ type: 'text', text: 'result' }] };
  } }, 1, agentModel);
  const reply = new AiSdkOrchestratorReply(settings, [{ id: 'home', description: 'Control home', reply: home }], router);
  await collect(reply.produce(history, stop));
  const routerSignal = router.doGenerateCalls[0]?.abortSignal;
  const agentSignal = agentModel.doStreamCalls[0]?.abortSignal;
  expect([routerSignal?.aborted, agentSignal?.aborted, toolSignals[0]?.aborted]).toEqual([false, false, false]);
  request();
  await new Promise(resolve => setImmediate(resolve));
  expect([routerSignal?.aborted, agentSignal?.aborted, toolSignals[0]?.aborted]).toEqual([true, true, true]);
});

test('specialist executes discovered MCP tools and allows a final answer at its call limit', async () => {
  const called: unknown[] = [];
  const model = scripted(
    { parts: [callPart('lookup', { key: 'answer' })], reason: 'tool-calls' },
    { parts: answer('Found it'), reason: 'stop' },
  );
  const reply = new AiSdkToolAgentReply(settings, { prompts: [], tools: [{ name: 'lookup',
    inputSchema: { type: 'object', properties: { key: { type: 'string' } },
      required: ['key'] } }] }, { getPrompt, async callTool(name, args) {
    called.push({ name, args });
    return { isError: false, content: [{ type: 'text', text: 'result' }] };
  } }, 1, model);
  expect(await collect(reply.produce(history, never()))).toEqual([text('Found it'), expectation(false)]);
  expect(called).toEqual([{ name: 'lookup', args: { key: 'answer' } }]);
  expect(model.doStreamCalls).toHaveLength(2);
  // The specialist answers the family's original text, the last turn of the history.
  expect(model.doStreamCalls[0]?.prompt.at(-1)).toEqual(
    { role: 'user', content: [{ type: 'text', text: 'Find it' }] });
});

test('specialist refuses the first MCP call beyond its per-turn limit', async () => {
  const called: string[] = [];
  const model = scripted(
    { parts: [callPart('lookup', {})], reason: 'tool-calls' },
    { parts: [callPart('lookup', {}, 'call-2')], reason: 'tool-calls' },
  );
  const reply = new AiSdkToolAgentReply(settings, { prompts: [], tools: [{ name: 'lookup',
    inputSchema: { type: 'object' } }] }, { getPrompt, async callTool(name) {
    called.push(name); return { isError: false, content: [] };
  } }, 1, model);
  await expect(collect(reply.produce(history, never()))).rejects.toThrow('MCP tool call limit exceeded');
  expect(called).toEqual(['lookup']);
});

// Verification: Prova dei nomi degli strumenti MCP
test('specialist offers accepted MCP names and positional names for the others', async () => {
  const long = 'a'.repeat(65);
  const discovered = ['HassTurnOff', 'GetLiveContext', 'light.toggle', long, 'mcp_7', '_private', '1st-tool',
    '-dash'].map(name => ({
    name, description: `Tool ${name}`, inputSchema: { type: 'object', properties: { name: { type: 'string' } } } }));
  const called: unknown[] = [];
  const model = scripted(
    { parts: [callPart('GetLiveContext', { name: 'camera' })], reason: 'tool-calls' },
    { parts: [callPart('mcp_2', {}, 'call-2')], reason: 'tool-calls' },
    { parts: [callPart('mcp_4', {}, 'call-3')], reason: 'tool-calls' },
    { parts: [callPart('mcp_6', {}, 'call-4')], reason: 'tool-calls' },
    { parts: [callPart('_private', {}, 'call-5')], reason: 'tool-calls' },
    { parts: answer('Fatto.'), reason: 'stop' },
  );
  const reply = new AiSdkToolAgentReply(settings, { tools: discovered, prompts: [] }, { getPrompt,
    async callTool(name, args) { called.push({ name, args }); return { isError: false, content: [] }; } }, 5, model);
  expect(await collect(reply.produce(history, never()))).toEqual([text('Fatto.'), expectation(false)]);
  const offered = model.doStreamCalls[0]?.tools ?? [];
  // Gemini requires a leading letter or underscore, so digits and dashes there get positional names.
  expect(offered.map(tool => tool.name)).toEqual(['HassTurnOff', 'GetLiveContext', 'mcp_2', 'mcp_3', 'mcp_4',
    '_private', 'mcp_6', 'mcp_7']);
  expect(offered[2]).toMatchObject({ description: 'Tool light.toggle',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } } } });
  expect(called).toEqual([{ name: 'GetLiveContext', args: { name: 'camera' } },
    { name: 'light.toggle', args: {} }, { name: 'mcp_7', args: {} }, { name: '1st-tool', args: {} },
    { name: '_private', args: {} }]);
});

// Verification: Prova delle istruzioni del server MCP
test('specialist reads the server prompts at every turn and puts them before the reply format', async () => {
  const versions = ['Static Context: kitchen light', 'Static Context: kitchen and bedroom lights'];
  const read: Array<{ name: string; signal?: AbortSignal }> = [];
  const model = scripted({ parts: answer('Uno.'), reason: 'stop' }, { parts: answer('Due.'), reason: 'stop' });
  const reply = new AiSdkToolAgentReply(settings, { tools: [], prompts: ['assist'] }, {
    async getPrompt(name, signal) { read.push({ name, signal }); return versions[read.length - 1]!; },
    async callTool() { throw new Error('Unexpected tool call'); } }, 1, model);
  await collect(reply.produce(history, never()));
  await collect(reply.produce(history, never()));
  expect(read.map(({ name }) => name)).toEqual(['assist', 'assist']);
  expect(read[0]?.signal).toBeInstanceOf(AbortSignal);
  const systems = model.doStreamCalls.map(call => String(call.prompt[0]?.content));
  expect(systems[0]).toBe(`${settings.instructions}\n\nInstructions and context from the connected MCP server:\n`
    + `${versions[0]}\nPut the words of your reply in answer. `
    + 'Set expectsReply to true only when the answer asks the user to reply; otherwise set it to false.');
  expect(systems[1]).toContain(versions[1]);
  expect(systems[1]).not.toContain(`${versions[0]}\n`);
});

// Verification: Prova delle istruzioni del server MCP
test('a failed prompt read fails the turn without calling the model', async () => {
  const model = scripted({ parts: answer('unused'), reason: 'stop' });
  const reply = new AiSdkToolAgentReply(settings, { tools: [], prompts: ['assist'] }, {
    async getPrompt() { throw new ProjectError('MCP prompt retrieval failed'); },
    async callTool() { throw new Error('Unexpected tool call'); } }, 1, model);
  await expect(collect(reply.produce(history, never()))).rejects.toThrow('MCP prompt retrieval failed');
  expect(model.doStreamCalls).toHaveLength(0);
});

test('provider options remain validated and map to AI SDK settings', () => {
  expect(aiSdkOptions({ temperature: 0.2, max_tokens: 128 })).toEqual({
    temperature: 0.2, maxOutputTokens: 128 });
  expect(aiSdkOptions()).toEqual({});
  expect(() => aiSdkOptions({ top_p: 0.2 })).toThrow('Unsupported model option');
  expect(() => aiSdkOptions({ temperature: -1 })).toThrow('Invalid model temperature');
  expect(() => aiSdkOptions({ max_tokens: 0 })).toThrow('Invalid model max_tokens');
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
    const reply = new AiSdkKnowledgeAgentReply({ ...settings,
      options: { temperature: 0.2, max_tokens: 128 } });
    expect(await collect(reply.produce(history, never())))
      .toEqual([text('SDK answer'), expectation(false)]);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(seen[0]?.authorization).toBe('Bearer fake-key');
    expect(seen[0]?.body).toMatchObject({ model: 'mistral-small-latest', stream: true,
      temperature: 0.2, max_tokens: 128, response_format: { type: 'json_schema' } });
  } finally { vi.unstubAllGlobals(); }
});

// Verification: Prova della scelta dell'agente da parte dell'orchestratore
test('the router asks Mistral for a closed agent choice without tools', async () => {
  const requests: Array<Record<string, unknown>> = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(JSON.parse(await request.text()) as Record<string, unknown>);
    return Response.json({ id: 'controlled-2', object: 'chat.completion', created: 0,
      model: 'mistral-medium-latest', choices: [{ index: 0,
        message: { role: 'assistant', content: '{"agent":"home"}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  });
  try {
    const reply = new AiSdkOrchestratorReply({ ...settings, model: 'mistral-medium-latest' }, [
      recordingAgent('home', 'Control home', [text('Fatto.'), expectation(false)])]);
    expect(await collect(reply.produce(history, never()))).toEqual([
      { kind: 'agent', agent: 'home' }, text('Fatto.'), expectation(false)]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: 'mistral-medium-latest',
      response_format: { type: 'json_schema' } });
    expect(requests[0]!.tools).toBeUndefined();
    expect(JSON.stringify(requests[0]!.response_format)).toContain('"enum":["home"]');
  } finally { vi.unstubAllGlobals(); }
});

type Seen = { url: string; headers: Headers; body: Record<string, unknown> };

// Verification: Prova della configurazione dell'adapter AI SDK
test.each([
  { provider: 'openai' as const, model: 'gpt-model', check: (seen: Seen) => {
    expect(seen.url).toBe('https://api.openai.com/v1/responses');
    expect(seen.headers.get('authorization')).toBe('Bearer fake-key');
  } },
  { provider: 'anthropic' as const, model: 'claude-sonnet-4-5', check: (seen: Seen) => {
    expect(seen.url).toBe('https://api.anthropic.com/v1/messages');
    expect(seen.headers.get('x-api-key')).toBe('fake-key');
    expect(seen.headers.get('authorization')).toBeNull();
  } },
  { provider: 'google' as const, model: 'gemini-model', check: (seen: Seen) => {
    expect(seen.url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-model:streamGenerateContent/);
    expect(seen.headers.get('x-goog-api-key')).toBe('fake-key');
    expect(seen.headers.get('authorization')).toBeNull();
    expect(seen.body.generationConfig).toMatchObject({ responseMimeType: 'application/json' });
  } },
  { provider: 'openai-compatible' as const, model: 'local-model', baseURL: 'https://models.example/v1',
    check: (seen: Seen) => {
      expect(seen.url).toBe('https://models.example/v1/chat/completions');
      expect(seen.headers.get('authorization')).toBe('Bearer fake-key');
      expect(seen.body.response_format).toMatchObject({ type: 'json_schema' });
    } },
])('the $provider provider sends the model, key and reply schema to its endpoint', async ({ check, ...llm }) => {
  const seen: Seen[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({ url: request.url, headers: request.headers,
      body: JSON.parse(await request.text()) as Record<string, unknown> });
    return new Response('controlled failure', { status: 400 });
  });
  try {
    const reply = new AiSdkKnowledgeAgentReply({ ...settings, ...llm, options: { temperature: 0.2 } });
    await expect(collect(reply.produce(history, never()))).rejects.toThrow('AI SDK response failed');
    expect(seen).toHaveLength(1);
    check(seen[0]!);
    // Gemini carries the model in the path, the others in the body.
    expect(seen[0]!.url + JSON.stringify(seen[0]!.body)).toContain(llm.model);
    // The reply schema reaches the provider, whatever field each API uses for it.
    expect(JSON.stringify(seen[0]!.body)).toContain('expectsReply');
  } finally { vi.unstubAllGlobals(); }
});

// Verification: Prova della configurazione dell'adapter AI SDK
test('an OpenAI-compatible agent without an endpoint is rejected before any request', () => {
  expect(() => new AiSdkKnowledgeAgentReply({ ...settings, provider: 'openai-compatible' }))
    .toThrow('Invalid agent configuration');
  expect(() => new AiSdkKnowledgeAgentReply({ ...settings, baseURL: 'https://models.example/v1' }))
    .toThrow('Invalid agent configuration');
});
