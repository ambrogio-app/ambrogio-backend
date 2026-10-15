import { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import { STT, TTS } from '@micdrop/server';
import type { WebSocket } from 'ws';
import { describe, expect, it } from 'vitest';
import type { ExchangeTurn } from '../../../src/application/exchange-turn.use-case.js';
import { attachVoiceSession } from '../../../src/adapters/in/voice/voice-session.js';

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
  it('streams speech to transcription, reuses one conversation for replies, and closes after playback inactivity', async () => {
    const socket = new Socket();
    const stt = new Transcriber(['prima domanda', '  seconda domanda  ']);
    const tts = new Synthesizer();
    const inputs: unknown[] = [];
    const exchange: ExchangeTurn = async (input, observer) => {
      inputs.push(input);
      await observer?.delta?.('risposta');
      return { ok: true, value: { conversationId: input.conversationId!, turnId: String(inputs.length),
        outcome: 'answered' } };
    };
    attachVoiceSession(socket as unknown as WebSocket, { conversationId: 'voice-1', exchange, stt, tts,
      inactivityMs: 30 });
    speak(socket);
    await until(() => tts.spoken.length === 1);
    expect(inputs).toEqual([{ text: 'prima domanda', conversationId: 'voice-1' }]);
    expect(tts.spoken).toEqual(['risposta']);
    expect(stt.chunks).toHaveLength(1);
    socket.receive('Played');
    socket.receive('Played');
    speak(socket);
    await until(() => tts.spoken.length === 2);
    expect(inputs).toEqual([
      { text: 'prima domanda', conversationId: 'voice-1' },
      { text: '  seconda domanda  ', conversationId: 'voice-1' },
    ]);
    expect(socket.closed).toBe(false);
    socket.receive('Played');
    speak(socket); // an unusable follow-up cannot keep an inactive session open forever
    await until(() => socket.closed);
  });

  it('creates no exchange for unusable transcription and reports a turn admission rejection', async () => {
    const socket = new Socket();
    let calls = 0;
    const exchange: ExchangeTurn = async () => {
      calls += 1;
      return { ok: false, error: { kind: 'occupied' } };
    };
    const tts = new Synthesizer();
    attachVoiceSession(socket as unknown as WebSocket, { conversationId: 'voice-2', exchange,
      stt: new Transcriber(['   ', 'domanda']), tts, inactivityMs: 30 });
    speak(socket);
    await new Promise<void>(resolve => setTimeout(resolve, 5));
    expect(calls).toBe(0);
    speak(socket);
    await until(() => calls === 1);
    expect(socket.sent).toContain('TurnRejected {"kind":"occupied"}');
    expect(tts.spoken).toEqual([]);
    socket.close();
  });
});
