import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { startConsultationServer } from '../../src/runtime/consultation-server.js';
import { startConversationServer } from '../../src/runtime/conversation-server.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })));
});

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return address.port;
}

test('loads the active component JSON once and retains validated values after startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-bootstrap-'));
  directories.push(directory);
  const http = join(directory, 'http.json');
  const conversations = join(directory, 'conversations.json');
  const archive = join(directory, 'archive.sqlite');
  const port = await freePort();
  await writeFile(http, JSON.stringify({ host: '127.0.0.1', port,
    allowedOrigins: ['https://allowed.example'], publicHttps: true, hstsMaxAgeSeconds: 120 }));
  await writeFile(conversations, JSON.stringify({ archivePath: archive,
    language: 'it', listPageSize: 2, maxListPageSize: 3 }));

  const runtime = await startConsultationServer({
    AMBROGIO_HTTP_CONFIG_PATH: http,
    AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations,
    AMBROGIO_VOICE_CONFIG_PATH: join(directory, 'absent-voice.json'),
    HOST: '0.0.0.0', PORT: String(port + 1),
    AMBROGIO_LANGUAGE: 'en',
  });
  try {
    const request = () => fetch(`http://127.0.0.1:${port}/api/conversations`, {
      headers: { origin: 'https://allowed.example' },
    });
    const before = await request();
    expect(before.status).toBe(200);
    expect(before.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
    expect(before.headers.get('strict-transport-security')).toBe('max-age=120');
    expect((await before.json() as { items: unknown[] }).items).toEqual([]);

    await writeFile(http, '{ "secret": "must-not-reload"');
    await writeFile(conversations, '{ "secret": "must-not-reload"');
    const after = await request();
    expect(after.status).toBe(200);
    expect(after.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
    expect(after.headers.get('strict-transport-security')).toBe('max-age=120');
    expect((await after.json() as { items: unknown[] }).items).toEqual([]);
  } finally {
    await runtime.close();
  }
});

test('rejects a secret-bearing invalid component JSON before opening its archive or listener', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-bootstrap-'));
  directories.push(directory);
  const http = join(directory, 'http.json');
  const conversations = join(directory, 'conversations.json');
  const archive = join(directory, 'archive.sqlite');
  const port = await freePort();
  await writeFile(http, JSON.stringify({ host: '127.0.0.1', port }));
  await writeFile(conversations, JSON.stringify({ archivePath: { secret: 'private-marker' } }));

  let failure: unknown;
  try {
    await startConsultationServer({ AMBROGIO_HTTP_CONFIG_PATH: http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations });
  } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toBe('Invalid conversation archive path');
  expect(String(failure)).not.toContain('private-marker');
  await expect(access(archive)).rejects.toMatchObject({ code: 'ENOENT' });

  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>(resolve => probe.close(() => resolve()));
});

test('uses the validated agent, HTTP and conversation JSON throughout the active server', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-bootstrap-'));
  directories.push(directory);
  const http = join(directory, 'http.json');
  const conversations = join(directory, 'conversations.json');
  const archive = join(directory, 'archive.sqlite');
  const agents = join(directory, 'agents');
  const port = await freePort();
  await mkdir(agents);
  await writeFile(http, JSON.stringify({ host: '127.0.0.1', port,
    allowedOrigins: ['https://allowed.example'] }));
  await writeFile(conversations, JSON.stringify({ archivePath: archive, language: 'it' }));
  await writeFile(join(agents, 'orchestrator.json'), JSON.stringify({
    instructions: 'Rispondi brevemente.',
    llm: { provider: 'mistral', model: 'mistral-small-latest', apiKey: 'json-agent-key' },
  }));

  const seen: Array<{ authorization: string | null; body: unknown }> = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push({ authorization: request.headers.get('authorization'),
      body: JSON.parse(await request.text()) as unknown });
    const event = { id: 'controlled-1', object: 'chat.completion.chunk', created: 0,
      model: 'mistral-small-latest', choices: [{ index: 0, delta: { content: 'Risposta' },
        finish_reason: null }] };
    return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  });
  try {
    const runtime = await startConversationServer({ AMBROGIO_HTTP_CONFIG_PATH: http,
      AMBROGIO_CONVERSATIONS_CONFIG_PATH: conversations, HOST: '0.0.0.0',
      PORT: String(port + 1), AMBROGIO_LANGUAGE: 'en',
      AMBROGIO_VOICE_CONFIG_PATH: join(directory, 'missing-voice.json') }, agents);
    try {
      const turn = () => runtime.server.inject({ method: 'POST', url: '/api/conversations/turns',
        headers: { origin: 'https://allowed.example', 'content-type': 'application/json' },
        payload: { text: 'Domanda' } });
      const before = await turn();
      expect(before.statusCode).toBe(200);
      expect(before.body).toContain('Risposta');
      expect(before.headers['access-control-allow-origin']).toBe('https://allowed.example');
      const invalidBefore = await runtime.server.inject({ method: 'POST',
        url: '/api/conversations/turns', payload: { text: '' } });
      expect(invalidBefore.json()).toEqual({ error: 'Messaggio non valido.' });

      await writeFile(http, '{');
      await writeFile(conversations, '{');
      await writeFile(join(agents, 'orchestrator.json'), '{');
      const after = await turn();
      expect(after.statusCode).toBe(200);
      expect(after.body).toContain('Risposta');
      expect(after.headers['access-control-allow-origin']).toBe('https://allowed.example');
      const invalidAfter = await runtime.server.inject({ method: 'POST',
        url: '/api/conversations/turns', payload: { text: '' } });
      expect(invalidAfter.json()).toEqual({ error: 'Messaggio non valido.' });
      expect(seen.map(request => request.authorization)).toEqual([
        'Bearer json-agent-key', 'Bearer json-agent-key',
      ]);
      expect(seen.every(request => (request.body as { messages?: Array<{ content: string }> })
        .messages?.[0]?.content === 'Rispondi brevemente.')).toBe(true);
    } finally { await runtime.close(); }
  } finally { vi.unstubAllGlobals(); }
});
