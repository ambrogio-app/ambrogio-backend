import { EventEmitter } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { expect, test } from 'vitest';
import type { createVoiceComponents } from '@ambrogio/conversations/adapters/in/voice/voice-session';
import { prepareConfiguredConversations } from '../../src/composition/conversations.js';
import { buildConsultationServer, buildConversationServer } from '../../src/runtime/consultation-server.js';

function gate() {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  return { waiting, release };
}

async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i += 1) {
    if (predicate()) return;
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Expected voice state did not arrive');
}

async function connect(url: string) {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  const messages: Array<string | ArrayBuffer> = [];
  ws.addEventListener('message', event => messages.push(event.data));
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('error', () => reject(new Error('WebSocket failed')), { once: true });
  });
  await until(() => messages.some(message => typeof message === 'string' && message.startsWith('Ready ')));
  const ready = messages.find(message => typeof message === 'string' && message.startsWith('Ready ')) as string;
  return { ws, messages, conversationId: (JSON.parse(ready.slice(6)) as { conversationId: string }).conversationId };
}

function speak(ws: WebSocket) {
  ws.send('StartSpeaking');
  ws.send(new Uint8Array(32));
  ws.send('StopSpeaking');
}

test('WebSocket voice and HTTP share the archive, admission, and HTTP listener', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-voice-server-'));
  const prepared = await prepareConfiguredConversations({ archivePath: join(directory, 'archive.sqlite'),
    listPageSize: 20, maxListPageSize: 100, language: 'it' }, new Date());
  const pending = gate();
  const httpPending = gate();
  const transcripts = ['prima domanda', 'seconda domanda', 'nuova interazione'];
  const components: typeof createVoiceComponents = () => {
    const stt = new class extends EventEmitter {
      transcribe(stream: Readable) {
        stream.resume();
        stream.once('end', () => this.emit('Transcript', transcripts.shift() ?? ''));
      }
      destroy() {}
    }();
    const tts = new class extends EventEmitter {
      speak(stream: Readable) {
        stream.resume();
        stream.once('end', () => this.emit('Audio', Buffer.from([1, 2, 3, 4])));
      }
      cancel() {}
      destroy() {}
    }();
    return { stt, tts } as ReturnType<typeof createVoiceComponents>;
  };
  let replies = 0;
  const built = await buildConversationServer({ host: '127.0.0.1', port: 0,
    allowedOrigins: [], publicHttps: false }, prepared,
  { async *produce() { replies += 1; if (replies === 1) await pending.waiting;
    if (replies === 4) await httpPending.waiting; yield `risposta ${replies}`; } },
  { voskModelPath: '/unused', piperModelPath: '/unused', piperBinaryPath: '/unused', inactivityMs: 60 },
  components);
  const { server } = built;
  let first: Awaited<ReturnType<typeof connect>> | undefined;
  let second: Awaited<ReturnType<typeof connect>> | undefined;
  let stopped = false;
  try {
    const origin = await server.listen({ host: '127.0.0.1', port: 0 });
    first = await connect(origin.replace('http:', 'ws:') + '/api/voice');
    speak(first.ws);
    await until(() => replies === 1);
    const busy = await server.inject({ method: 'POST', url: '/api/conversations/turns',
      payload: { text: 'turno HTTP simultaneo' } });
    expect(busy.statusCode).toBe(409);
    const pendingHistory = await server.inject({ method: 'GET',
      url: `/api/conversations/${first.conversationId}` });
    expect(pendingHistory.json().turns[0].text).toBe('prima domanda');
    pending.release();
    await until(() => first!.messages.some(message => message instanceof ArrayBuffer));
    first.ws.send('Played');
    speak(first.ws);
    await until(() => (first!.messages.filter(message => message instanceof ArrayBuffer)).length === 2);
    const history = await server.inject({ method: 'GET',
      url: `/api/conversations/${first.conversationId}` });
    expect(history.json().turns.map((turn: { text: string }) => turn.text))
      .toEqual(['prima domanda', 'seconda domanda']);
    first.ws.send('Played');
    await until(() => first!.ws.readyState === WebSocket.CLOSED);
    second = await connect(origin.replace('http:', 'ws:') + '/api/voice');
    expect(second.conversationId).not.toBe(first.conversationId);
    speak(second.ws);
    await until(() => second!.messages.some(message => message instanceof ArrayBuffer));
    const newHistory = await server.inject({ method: 'GET',
      url: `/api/conversations/${second.conversationId}` });
    expect(newHistory.json().turns[0].text).toBe('nuova interazione');
    second.ws.close();
    const httpTurn = server.inject({ method: 'POST', url: '/api/conversations/turns',
      payload: { text: 'turno HTTP in corso' } });
    await until(() => replies === 4);
    const denied = new WebSocket(origin.replace('http:', 'ws:') + '/api/voice');
    const deniedMessages: string[] = [];
    denied.addEventListener('message', event => deniedMessages.push(String(event.data)));
    await until(() => deniedMessages.some(message => message.startsWith('TurnRejected ')));
    expect(deniedMessages).toContain('TurnRejected {"kind":"occupied"}');
    expect(deniedMessages.some(message => message.startsWith('Ready '))).toBe(false);
    httpPending.release();
    expect((await httpTurn).statusCode).toBe(200);
    await built.turnIngress.stopAccepting();
    await server.close();
    await prepared.archive.close();
    stopped = true;
    const reopened = await prepareConfiguredConversations({ archivePath: join(directory, 'archive.sqlite'),
      listPageSize: 20, maxListPageSize: 100, language: 'it' }, new Date());
    const consultation = await buildConsultationServer({ host: '127.0.0.1', port: 0,
      allowedOrigins: [], publicHttps: false }, reopened);
    try {
      const persisted = await consultation.inject({ method: 'GET',
        url: `/api/conversations/${first.conversationId}` });
      expect(persisted.json().turns.map((turn: { text: string }) => turn.text))
        .toEqual(['prima domanda', 'seconda domanda']);
      expect((await readdir(directory)).filter(name => /\.(wav|pcm|raw|opus|mp3)$/i.test(name)))
        .toEqual([]);
    } finally {
      await consultation.close();
      await reopened.archive.close();
    }
  } finally {
    pending.release();
    httpPending.release();
    first?.ws.close();
    second?.ws.close();
    if (!stopped) {
      await built.turnIngress.stopAccepting();
      await server.close();
      await prepared.archive.close();
    }
    await rm(directory, { recursive: true, force: true });
  }
});
