import { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import { STT, TTS } from '@micdrop/server';
import type { WebSocket } from 'ws';
import { describe, expect, it } from 'vitest';
import type { ExchangeTurn } from '../../../src/application/exchange-turn.use-case.js';
import { attachVoiceSession } from '../../../src/adapters/in/voice/voice-session.adapter.js';

class Socket extends EventEmitter {
  readonly sent: Array<string | Buffer> = [];
  closed = false;
  send(value: string | Buffer) { this.sent.push(value); }
  close() { this.closed = true; this.emit('close'); }
  receive(value: string | Buffer) { this.emit('message', Buffer.isBuffer(value) ? value : Buffer.from(value),
    Buffer.isBuffer(value)); }
}

class Transcriber extends STT {
  readonly chunks: Buffer[] = [];
  constructor(private readonly transcripts: string[]) { super(); }
  transcribe(stream: Readable) {
    stream.on('data', chunk => this.chunks.push(chunk));
    stream.once('end', () => this.emit('Transcript', this.transcripts.shift() ?? ''));
  }
}

class Synthesizer extends TTS {
  readonly spoken: string[] = [];
  speak(stream: Readable) {
    let text = '';
    stream.on('data', chunk => { text += chunk.toString(); });
    stream.once('end', () => { this.spoken.push(text); this.emit('Audio', Buffer.from([1, 2, 3])); });
  }
  cancel() {}
}

async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i += 1) {
    if (predicate()) return;
    await new Promise<void>(resolve => setTimeout(resolve, 2));
  }
  throw new Error('Expected voice event did not arrive');
}

function speak(socket: Socket) {
  socket.receive('StartSpeaking');
  socket.receive(Buffer.alloc(32));
  socket.receive('StopSpeaking');
}

describe('Micdrop voice interaction adapter', () => {
  it('streams speech to transcription and reuses one conversation until the client closes', async () => {
    const socket = new Socket();
    const stt = new Transcriber(['prima domanda', '  seconda domanda  ']);
    const tts = new Synthesizer();
    const inputs: unknown[] = [];
    const exchange: ExchangeTurn = async (input, observer) => {
      inputs.push(input);
      await observer?.delta?.('risposta');
      return { ok: true, value: { conversationId: input.conversationId!, turnId: String(inputs.length),
        outcome: 'answered', expectsReply: inputs.length === 1 } };
    };
    attachVoiceSession(socket as unknown as WebSocket, { conversationId: 'voice-1', exchange, stt, tts,
      language: 'it' });
    speak(socket);
    await until(() => tts.spoken.length === 1);
    expect(inputs).toEqual([{ text: 'prima domanda', conversationId: 'voice-1' }]);
    expect(tts.spoken).toEqual(['risposta']);
    expect(socket.sent).toContain('Message {"role":"assistant","content":"risposta","metadata":{"expectsReply":true}}');
    expect(stt.chunks).toHaveLength(1);
    speak(socket);
    await until(() => tts.spoken.length === 2);
    expect(inputs).toEqual([
      { text: 'prima domanda', conversationId: 'voice-1' },
      { text: '  seconda domanda  ', conversationId: 'voice-1' },
    ]);
    expect(socket.closed).toBe(false);
    expect(socket.sent).toContain('Message {"role":"assistant","content":"risposta","metadata":{"expectsReply":false}}');
    await new Promise<void>(resolve => setTimeout(resolve, 40));
    expect(socket.closed).toBe(false);
    socket.close();
  });

  it('leaves playback completion to the client when the reply flag is missing', async () => {
    const socket = new Socket();
    const exchange: ExchangeTurn = async (input, observer) => {
      await observer?.delta?.('Risposta?');
      return { ok: true, value: { conversationId: input.conversationId!, turnId: 'one',
        outcome: 'answered' } };
    };
    attachVoiceSession(socket as unknown as WebSocket, { conversationId: 'voice-3', exchange,
      stt: new Transcriber(['domanda']), tts: new Synthesizer(), language: 'it' });
    speak(socket);
    await until(() => socket.sent.some(message => typeof message === 'string'
      && message.startsWith('Message {"role":"assistant"')));
    expect(socket.sent).toContain('Message {"role":"assistant","content":"Risposta?","metadata":{}}');
    expect(socket.closed).toBe(false);
    socket.close();
  });

  it('delivers the reply flag after answer generation without a playback command', async () => {
    const socket = new Socket();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let markStarted!: () => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const exchange: ExchangeTurn = async (input, observer) => {
      await observer?.delta?.('Finito.');
      markStarted();
      await pending;
      return { ok: true, value: { conversationId: input.conversationId!, turnId: 'one',
        outcome: 'answered', expectsReply: false } };
    };
    const tts = new Synthesizer();
    attachVoiceSession(socket as unknown as WebSocket, { conversationId: 'voice-4', exchange,
      stt: new Transcriber(['domanda']), tts, language: 'it' });
    speak(socket);
    await started;
    expect(socket.closed).toBe(false);
    release();
    await until(() => socket.sent.some(message => typeof message === 'string'
      && message.includes('"expectsReply":false')));
    expect(socket.sent).toContain('Message {"role":"assistant","content":"Finito.","metadata":{"expectsReply":false}}');
    expect(socket.closed).toBe(false);
    socket.close();
  });

  it('speaks a safe rejection without creating a turn for unusable transcription', async () => {
    const socket = new Socket();
    let calls = 0;
    const exchange: ExchangeTurn = async () => {
      calls += 1;
      return { ok: false, error: { kind: 'occupied' } };
    };
    const tts = new Synthesizer();
    attachVoiceSession(socket as unknown as WebSocket, { conversationId: 'voice-2', exchange,
      stt: new Transcriber(['   ', 'domanda']), tts, language: 'it' });
    speak(socket);
    await new Promise<void>(resolve => setTimeout(resolve, 5));
    expect(calls).toBe(0);
    speak(socket);
    await until(() => tts.spoken.length === 1);
    expect(calls).toBe(1);
    expect(tts.spoken).toEqual(['Un altro turno è in corso.']);
    expect(socket.sent).toContain('Message {"role":"assistant","content":"Un altro turno è in corso.","metadata":{"expectsReply":false}}');
    expect(socket.closed).toBe(false);
    socket.close();
  });
});
