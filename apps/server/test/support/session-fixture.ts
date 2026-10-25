import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { ConversationHistory } from '@ambrogio/conversations/application/conversation-history-read';
import type { ProduceConversationReply, ReplyPart } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { SpeechComponents, SpeechComponentsFactory } from '@ambrogio/conversations/adapters/in/session/speech-components';
import { prepareConfiguredConversations } from '../../src/composition/conversations.js';
import { buildConversationServer } from '../../src/composition/http-surface.js';
import { surfaceOptions } from './logger-fixture.js';

export type Language = 'en' | 'it';
export type Reason = 'invalid' | 'conversation_not_found' | 'occupied' | 'unavailable' | 'too_large'
  | 'transcription_failed' | 'audio_unavailable' | 'failure';

export const publicMessages: Record<Language, Record<Reason, string>> = {
  en: {
    invalid: 'Invalid message.',
    conversation_not_found: 'Conversation not found.',
    occupied: 'Another turn is in progress.',
    unavailable: 'Service temporarily unavailable.',
    too_large: 'Request too large.',
    transcription_failed: "I didn't understand the request.",
    audio_unavailable: 'Voice is not available.',
    failure: "I can't complete the response.",
  },
  it: {
    invalid: 'Messaggio non valido.',
    conversation_not_found: 'Conversazione non trovata.',
    occupied: 'Un altro turno è in corso.',
    unavailable: 'Servizio temporaneamente non disponibile.',
    too_large: 'Richiesta troppo grande.',
    transcription_failed: 'Non ho capito la richiesta.',
    audio_unavailable: 'La voce non è disponibile.',
    failure: 'Non riesco a completare la risposta.',
  },
};

/** 60 seconds of PCM16 mono at 16 kHz. */
export const maxAudioBytes = 60 * 16_000 * 2;
export const maxTextBytes = 65_536;
export const voiceSampleRate = 22_050;

export function gate() {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  return { waiting, release };
}

export function text(value: string): ReplyPart { return { kind: 'text', text: value }; }
export function expectation(expectsReply: boolean): ReplyPart { return { kind: 'reply_expectation', expectsReply }; }

/** A controllable reply producer; each call receives the persisted history of the admitted turn. */
export function scriptedReply(script: (history: ConversationHistory) => AsyncIterable<ReplyPart>) {
  const histories: ConversationHistory[] = [];
  const reply: ProduceConversationReply = {
    produce(history) { histories.push(history); return script(history); },
  };
  return { reply, histories };
}

export function echoReply(expectsReply = false) {
  return scriptedReply(async function* (history) {
    yield text(`eco: ${history.turns.at(-1)!.text}`);
    yield expectation(expectsReply);
  });
}

/**
 * Deterministic speech components: the transcript is the UTF-8 content of the received
 * audio, `FAIL` makes transcription throw, and synthesis emits the UTF-8 bytes of the text.
 */
export function fakeSpeech() {
  const state = { transcriptions: 0, interruptedTranscriptions: 0, synthesisAborts: 0, synthesisGate: undefined as Promise<void> | undefined,
    closed: false, receivedBytes: [] as number[] };
  const components: SpeechComponents = {
    transcriber: {
      async transcribe(audio) {
        const index = state.transcriptions;
        state.transcriptions += 1;
        state.receivedBytes[index] = 0;
        const parts: Buffer[] = [];
        try {
          for await (const chunk of audio) {
            parts.push(Buffer.from(chunk));
            state.receivedBytes[index]! += chunk.length;
          }
        } catch (error) {
          // An unfinished request interrupts the audio instead of ending it: nothing is transcribed.
          state.interruptedTranscriptions += 1;
          throw error;
        }
        const transcript = Buffer.concat(parts).toString('utf8');
        if (transcript.includes('FAIL')) throw new Error('Simulated transcription failure');
        return transcript.trim();
      },
    },
    synthesizer: {
      sampleRate: voiceSampleRate,
      async *synthesize(input, signal) {
        signal.addEventListener('abort', () => { state.synthesisAborts += 1; }, { once: true });
        for await (const piece of input) {
          if (state.synthesisGate) await state.synthesisGate;
          if (signal.aborted) return;
          yield Buffer.from(piece, 'utf8');
        }
      },
    },
    async close() { state.closed = true; },
  };
  const factory: SpeechComponentsFactory = () => components;
  return { factory, state };
}

export type SessionServer = Awaited<ReturnType<typeof startSessionServer>>;

export async function startSessionServer(options: Readonly<{
  reply?: ProduceConversationReply;
  voice?: boolean;
  allowedOrigins?: readonly string[];
  language?: Language;
  pingIntervalMs?: number;
}> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-session-'));
  const language = options.language ?? 'it';
  const prepared = await prepareConfiguredConversations({ archivePath: join(directory, 'archive.sqlite'),
    listPageSize: 20, maxListPageSize: 100, language, timeZone: 'UTC' }, new Date());
  const speech = fakeSpeech();
  const built = await buildConversationServer({ host: '127.0.0.1', port: 0,
    allowedOrigins: [...(options.allowedOrigins ?? [])], publicHttps: false }, prepared,
  options.reply ?? echoReply().reply,
  options.voice ? { sttEngine: 'whisper', sttModelDir: '/fake/whisper', sttLanguage: 'en', voiceEngine: 'piper', voiceModelDir: '/fake/voice' }
    : undefined,
  options.voice ? speech.factory : undefined,
  { ...surfaceOptions(), sessionPingIntervalMs: options.pingIntervalMs ?? 30_000 });
  await built.server.listen({ host: '127.0.0.1', port: 0 });
  const { port } = built.server.server.address() as AddressInfo;
  let closed = false;
  return {
    url: `ws://127.0.0.1:${port}/api/session`,
    origin: `http://127.0.0.1:${port}`,
    directory,
    language,
    messages: publicMessages[language],
    prepared,
    ingress: built.turnIngress,
    speech: speech.state,
    async conversationIds(): Promise<string[]> {
      const response = await built.server.inject({ method: 'GET', url: '/api/v1/conversations?limit=100' });
      return (response.json().items as Array<{ id: string }>).map(item => item.id);
    },
    async turns(conversationId: string): Promise<Array<{ id: string; text: string; status: string;
      answer?: string; error?: string }>> {
      const response = await built.server.inject({ method: 'GET', url: `/api/v1/conversations/${conversationId}` });
      return response.json().turns;
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        await built.turnIngress.stopAccepting();
        await built.turnIngress.closeSessions();
        await built.server.close();
      } finally {
        await prepared.archive.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

export async function waitUntil(probe: () => Promise<boolean> | boolean, label: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
