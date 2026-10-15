import { expect, test, vi } from 'vitest';
import { MistralConversationReply } from '../../../src/adapters/out/mistral-conversation-reply.js';

const settings = { instructions: 'Answer briefly.', model: 'mistral-small-latest', apiKey: 'fake-key' };

test('streams text deltas with the agent instructions and persisted context', async () => {
  const requests: unknown[] = [];
  const reply = new MistralConversationReply({ ...settings,
    options: { temperature: 0.2, max_tokens: 128 } }, async (request) => {
    requests.push(request);
    return (async function* () {
      yield { data: { choices: [{ delta: { content: 'Hello' } }] } };
      yield { data: { choices: [{ delta: { content: [{ type: 'text', text: ' world' }] } }] } };
    })();
  });
  const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(2), turns: [
    { id: 'earlier', acceptedAt: new Date(0), finishedAt: new Date(1),
      status: 'answered' as const, text: 'Hi', answer: 'Hi there' },
    { id: 'current', acceptedAt: new Date(2), status: 'pending' as const, text: 'Reply' },
  ] };
  const chunks: string[] = [];
  for await (const chunk of reply.produce(history)) chunks.push(chunk);
  expect(chunks).toEqual(['Hello', ' world']);
  expect(requests).toEqual([{ model: 'mistral-small-latest', temperature: 0.2, maxTokens: 128,
    messages: [{ role: 'system', content: 'Answer briefly.' }, { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hi there' }, { role: 'user', content: 'Reply' }] }]);
});

test('rejects unsupported or invalid provider options before contacting Mistral', () => {
  expect(() => new MistralConversationReply({ ...settings, options: { top_p: 0.2 } })).toThrow();
  expect(() => new MistralConversationReply({ ...settings, options: { temperature: -1 } })).toThrow();
  expect(() => new MistralConversationReply({ ...settings, options: { max_tokens: 0 } })).toThrow();
});

test('official Mistral SDK sends the configured model and key to its built-in endpoint', async () => {
  const seen: Array<{ url: string; authorization: string | null; body: unknown }> = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({ url: request.url, authorization: request.headers.get('authorization'),
      body: JSON.parse(await request.text()) as unknown });
    const event = { id: 'controlled-1', object: 'chat.completion.chunk', created: 0,
      model: 'mistral-small-latest', choices: [{ index: 0, delta: { content: 'SDK answer' },
        finish_reason: null }] };
    return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  });
  try {
    const reply = new MistralConversationReply(settings);
    const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(0),
      turns: [{ id: 'current', acceptedAt: new Date(0), status: 'pending' as const, text: 'Reply' }] };
    const chunks: string[] = [];
    for await (const chunk of reply.produce(history)) chunks.push(chunk);
    expect(chunks).toEqual(['SDK answer']);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(seen[0]?.authorization).toBe('Bearer fake-key');
    expect(seen[0]?.body).toMatchObject({ model: 'mistral-small-latest', stream: true,
      messages: [{ role: 'system', content: 'Answer briefly.' },
        { role: 'user', content: 'Reply' }] });
  } finally { vi.unstubAllGlobals(); }
});
