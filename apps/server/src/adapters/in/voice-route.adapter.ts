import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ExchangeTurn } from '@ambrogio/conversations/application/exchange-turn';
import type { createStartVoiceConversation } from '@ambrogio/conversations/application/start-voice-conversation';
import type { VoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import { attachVoiceSession, createVoiceComponents, voiceRoute } from '@ambrogio/conversations/adapters/in/voice/voice-session';

type WebSocket = Parameters<typeof attachVoiceSession>[0];

/** Translate HTTP/WebSocket admission and voice events into conversation use cases. */
export function registerVoiceIngress(server: FastifyInstance, dependencies: Readonly<{
  start: ReturnType<typeof createStartVoiceConversation>;
  exchange: ExchangeTurn;
  config: VoiceConfig;
  language: 'en' | 'it';
  components: typeof createVoiceComponents;
}>) {
  const { start, exchange, config, language, components } = dependencies;
  let accepting = true;
  const sessions = new Set<WebSocket>();
  const live = new Map<WebSocket, ReturnType<typeof attachVoiceSession>>();
  const admitted = new WeakMap<FastifyRequest, string>();
  server.get(voiceRoute, { websocket: true, async preValidation(request, response) {
    if (!accepting) return response.code(503).send({ error: 'Voice unavailable.' });
    try {
      const started = await start();
      if (!started.ok || !accepting) {
        return response.code(503).send({ error: 'Voice unavailable.' });
      }
      admitted.set(request, started.value.conversationId);
    } catch (error) {
      server.log.error({ event: 'voice.start_failed', err: error }, 'Voice start failed');
      return response.code(503).send({ error: 'Voice unavailable.' });
    }
  } }, (socket, request) => {
    if (!accepting) { socket.close(1013, 'Server stopping'); return; }
    const conversationId = admitted.get(request);
    if (!conversationId) { socket.close(1011, 'Voice admission missing'); return; }
    admitted.delete(request);
    sessions.add(socket);
    socket.once('close', () => {
      sessions.delete(socket);
      live.delete(socket);
    });
    socket.on('error', () => { /* close event owns cleanup */ });
    try {
      const { stt, tts } = components(config);
      const session = attachVoiceSession(socket, { conversationId,
        exchange, stt, tts, language });
      live.set(socket, session);
    } catch (error) {
      server.log.error({ event: 'voice.start_failed', err: error }, 'Voice start failed');
      socket.close(1011, 'Voice unavailable');
    }
  });
  return { async stopAccepting() {
    accepting = false;
    for (const socket of sessions) {
      const session = live.get(socket);
      if (session) session.close();
      else socket.close(1001, 'Server stopping');
    }
  } };
}
