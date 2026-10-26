import { testEnvironment, writeAgentFile } from '../../test/support/config-fixture.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { prepareAgents } from './agents.js';

const history = { id: 'conversation', createdAt: new Date(0), lastActivityAt: new Date(0),
  turns: [{ id: 'turn', acceptedAt: new Date(0), status: 'pending' as const, text: 'Question' }] };

test('passes each credential named by an agent file to its own controlled Mistral client', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-api-credentials-'));
  const seen: Array<{ authorization: string | null; body: unknown }> = [];
  const connections: unknown[] = [];
  vi.stubEnv('MISTRAL_API_KEY', 'environment-key-must-not-win');
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({ authorization: request.headers.get('authorization'),
      body: JSON.parse(await request.text()) as unknown });
    const body = JSON.parse(await new Request(input, init).text()) as { stream?: boolean };
    if (!body.stream) {
      return Response.json({ id: 'controlled-0', object: 'chat.completion', created: 0,
        model: 'mistral-small-latest', choices: [{ index: 0,
          message: { role: 'assistant', content: '{"agent":"bearer"}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    }
    const reply = (text: string) => [
      { id: 'controlled-1', object: 'chat.completion.chunk', created: 0, model: 'mistral-small-latest',
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }] },
      { id: 'controlled-1', object: 'chat.completion.chunk', created: 0, model: 'mistral-small-latest',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
    ].map(event => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n';
    return new Response(reply('answer'), {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  });
  try {
    await writeAgentFile(join(directory, 'orchestrator.json'), JSON.stringify({
      instructions: 'Coordinate.', llm: { provider: 'mistral', model: 'mistral-small-latest',
        apiKey: 'orchestrator-json-key' },
    }));
    await writeAgentFile(join(directory, 'bearer.json'), JSON.stringify({
      description: 'Use the service.', maxToolCalls: 1, instructions: 'Use tools.',
      llm: { provider: 'mistral', model: 'mistral-small-latest', apiKey: 'specialist-json-key' },
      mcp: { url: 'https://bearer.example/mcp',
        auth: { type: 'bearer', token: 'bearer-json-token' } },
    }));
    await writeAgentFile(join(directory, 'oauth.json'), JSON.stringify({
      description: 'Use another service.', maxToolCalls: 1, instructions: 'Use tools.',
      llm: { provider: 'mistral', model: 'mistral-small-latest', apiKey: 'oauth-agent-json-key' },
      mcp: { url: 'https://oauth.example/mcp', auth: {
        type: 'oauth_client_credentials', clientId: 'oauth-json-id',
        clientSecret: 'oauth-json-secret', issuer: 'https://issuer.example',
      } },
    }));
    const agents = await prepareAgents(directory, testEnvironment(), async (connection) => {
      connections.push(connection);
      return { listTools: async () => [], listPrompts: async () => [], getPrompt: async () => '',
        callTool: async () => ({ isError: false, content: [] }),
        close: async () => {} };
    });
    try {
      await writeAgentFile(join(directory, 'orchestrator.json'), '{');
      await writeAgentFile(join(directory, 'bearer.json'), '{');
      await writeAgentFile(join(directory, 'oauth.json'), '{');
      for await (const _chunk of agents.orchestrator.produce(history, { requested: new Promise<void>(() => { /* never */ }) })) { /* consume response */ }
      for (const specialist of agents.specialists) {
        for await (const _chunk of specialist.reply.produce(history, { requested: new Promise<void>(() => { /* never */ }) })) { /* consume response */ }
      }
      expect(seen.map(request => request.authorization)).toEqual([
        // The orchestrator chooses the bearer agent, which answers; then each agent answers directly.
        'Bearer orchestrator-json-key', 'Bearer specialist-json-key', 'Bearer specialist-json-key',
        'Bearer oauth-agent-json-key',
      ]);
      expect(seen.every(request => (request.body as { model?: string }).model
        === 'mistral-small-latest')).toBe(true);
      expect(connections).toEqual([
        { url: 'https://bearer.example/mcp',
          auth: { type: 'bearer', token: 'bearer-json-token' } },
        { url: 'https://oauth.example/mcp', auth: {
          type: 'oauth_client_credentials', clientId: 'oauth-json-id',
          clientSecret: 'oauth-json-secret', issuer: 'https://issuer.example',
        } },
      ]);
    } finally { await agents.close(); }
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
