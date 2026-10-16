import { MicdropServer, type STT, type TTS } from '@micdrop/server';
import { PiperTTS } from '@micdrop/piper';
import type { WebSocket } from 'ws';
import type { ExchangeTurn } from '../../../application/exchange-turn.use-case.js';
import type { VoiceConfig } from '../../out/voice-config.js';
import { ConversationVoiceAgent } from './conversation-agent.js';
import { VoskStreamingSTT } from './vosk-streaming-stt.js';

export const voiceRoute = '/api/voice';
export const playbackFinishedCommand = 'Played';

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
  inactivityMs: number;
}>): Readonly<{ close(): void }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let playbackPending = false;
  let playbackFinished = false;
  let expectsReply: boolean | undefined;
  let closed = false;
  let stopping = false;
  let deadline: number | undefined;
  let pausedRemaining: number | undefined;
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const armTimer = (milliseconds: number) => {
    clearTimer();
    deadline = Date.now() + milliseconds;
    timer = setTimeout(() => socket.close(1000, 'Voice interaction inactive'), milliseconds);
    timer.unref?.();
  };
  const resumeTimer = () => {
    if (pausedRemaining === undefined || closed) return;
    armTimer(pausedRemaining);
    pausedRemaining = undefined;
  };
  const finishPlayback = () => {
    if (!playbackPending || !playbackFinished || closed) return;
    playbackPending = false;
    playbackFinished = false;
    if (expectsReply === true) armTimer(dependencies.inactivityMs);
    else socket.close(1000, 'Voice interaction complete');
  };
  const agent = new ConversationVoiceAgent({
    conversationId: dependencies.conversationId,
    exchange: dependencies.exchange,
    rejected(error) {
      if (!closed) socket.send(`TurnRejected ${JSON.stringify(error)}`);
      resumeTimer();
    },
    responseReady(value) {
      pausedRemaining = undefined;
      expectsReply = value;
      playbackPending = true;
      finishPlayback();
    },
    shouldInterrupt() { return stopping; },
  });
  dependencies.stt.on('Transcript', transcript => {
    if (!transcript.trim()) resumeTimer();
  });
  socket.on('message', (data, isBinary) => {
    if (isBinary || closed) return;
    const command = data.toString();
    if (command === 'StartSpeaking') {
      if (deadline !== undefined) pausedRemaining = Math.max(0, deadline - Date.now());
      clearTimer();
      deadline = undefined;
      playbackPending = false;
      playbackFinished = false;
      expectsReply = undefined;
    } else if (command === playbackFinishedCommand) {
      playbackFinished = true;
      finishPlayback();
    }
  });
  socket.once('close', () => { closed = true; clearTimer(); });
  new MicdropServer(socket, { agent, stt: dependencies.stt, tts: dependencies.tts,
    partialMessages: true });
  return { close() { stopping = true; if (!closed) socket.close(1001, 'Server stopping'); } };
}
