import { attachVoiceSession, createVoiceComponents,
  voiceRoute } from '@ambrogio/conversations/adapters/in/voice/voice-session';
import type { VoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import { UuidIdentifiers } from '@ambrogio/conversations/adapters/out/uuid-identifiers';
import { createStartVoiceConversation } from '@ambrogio/conversations/application/start-voice-conversation';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { assembleExchangeTurn, type PreparedConversations } from './conversations.js';

type WebSocket = Parameters<typeof attachVoiceSession>[0];

/** Register a voice route on the existing HTTP listener. */
export function registerVoiceRoute(server: FastifyInstance, prepared: PreparedConversations,
  reply: ProduceConversationReply, config: VoiceConfig,
  components: typeof createVoiceComponents = createVoiceComponents) {
  const probe = components(config);
  probe.stt.destroy();
  probe.tts.destroy();
  const start = createStartVoiceConversation({
    archive: prepared.write,
    identifiers: new UuidIdentifiers(), clock: new SystemCurrentTime(),
  });
  const exchange = assembleExchangeTurn(prepared, reply);
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
        exchange, stt, tts, language: prepared.language });
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
