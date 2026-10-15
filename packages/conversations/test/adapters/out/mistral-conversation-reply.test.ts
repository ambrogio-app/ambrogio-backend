import { expect, test } from 'vitest';
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
