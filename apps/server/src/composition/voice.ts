import { attachVoiceSession, createVoiceComponents,
  voiceRoute } from '@ambrogio/conversations/adapters/in/voice/voice-session';
import type { VoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import { UuidIdentifiers } from '@ambrogio/conversations/adapters/out/uuid-identifiers';
import { createStartVoiceConversation } from '@ambrogio/conversations/application/start-voice-conversation';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { FastifyInstance } from 'fastify';
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
  server.get(voiceRoute, { websocket: true }, socket => {
    if (!accepting) { socket.close(1013, 'Server stopping'); return; }
    sessions.add(socket);
    socket.once('close', () => {
      sessions.delete(socket);
      live.delete(socket);
    });
    socket.on('error', () => { /* close event owns cleanup */ });
    void (async () => {
      const started = await start();
      if (!started.ok) {
        socket.send(`TurnRejected ${JSON.stringify(started.error)}`);
        socket.close(1013, 'Voice interaction unavailable');
        return;
      }
      if (!accepting || socket.readyState !== socket.OPEN) return;
      const { stt, tts } = components(config);
      const session = attachVoiceSession(socket, { conversationId: started.value.conversationId,
        exchange, stt, tts, inactivityMs: config.inactivityMs });
      live.set(socket, session);
      socket.send(`Ready ${JSON.stringify({ conversationId: started.value.conversationId })}`);
    })().catch(error => {
      server.log.error({ event: 'voice.start_failed', err: error }, 'Voice start failed');
      socket.close(1011, 'Voice unavailable');
    });
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
