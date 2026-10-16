import { MicdropServer, type STT, type TTS } from '@micdrop/server';
import { PiperTTS } from '@micdrop/piper';
import type { WebSocket } from 'ws';
import type { ExchangeTurn } from '../../../application/exchange-turn.use-case.js';
import type { BeginTurnRejection } from '../../../application/begin-turn.use-case.js';
import type { VoiceConfig } from '../../out/voice-config.js';
import { ConversationVoiceAgent } from './conversation-agent.js';
import { VoskStreamingSTT } from './vosk-streaming-stt.js';

export const voiceRoute = '/api/voice';

type Language = 'en' | 'it';
const rejectionMessages: Record<BeginTurnRejection['kind'], Record<Language, string>> = {
  occupied: { en: 'Another turn is in progress.', it: 'Un altro turno è in corso.' },
  conversation_not_found: { en: 'Conversation not found.', it: 'Conversazione non trovata.' },
  temporarily_unavailable: { en: 'Service temporarily unavailable.', it: 'Servizio temporaneamente non disponibile.' },
};

export function createVoiceComponents(config: VoiceConfig): Readonly<{ stt: STT; tts: TTS }> {
  return { stt: new VoskStreamingSTT(config.voskModelPath),
    tts: new PiperTTS({ modelPath: config.piperModelPath, binaryPath: config.piperBinaryPath }) };
}

/** Bind one explicit voice interaction to one WebSocket and one conversation. */
export function attachVoiceSession(socket: WebSocket, dependencies: Readonly<{
  conversationId: string;
  exchange: ExchangeTurn;
  stt: STT;
  tts: TTS;
  language: Language;
}>): Readonly<{ close(): void }> {
  let closed = false;
  let stopping = false;
  const agent = new ConversationVoiceAgent({
    conversationId: dependencies.conversationId,
    exchange: dependencies.exchange,
    rejected(error) {
      return rejectionMessages[error.kind][dependencies.language];
    },
    shouldInterrupt() { return stopping; },
  });
  socket.once('close', () => { closed = true; });
  new MicdropServer(socket, { agent, stt: dependencies.stt, tts: dependencies.tts,
    partialMessages: true });
  return { close() { stopping = true; if (!closed) socket.close(1001, 'Server stopping'); } };
}
