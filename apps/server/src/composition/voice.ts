import { createVoiceComponents } from '@ambrogio/conversations/adapters/in/voice/voice-session';
import type { VoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import { UuidIdentifiers } from '@ambrogio/conversations/adapters/out/uuid-identifiers';
import { createStartVoiceConversation } from '@ambrogio/conversations/application/start-voice-conversation';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { FastifyInstance } from 'fastify';
import { assembleExchangeTurn, type PreparedConversations } from './conversations.js';

import { registerVoiceIngress } from '../adapters/in/voice-route.adapter.js';

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
  return registerVoiceIngress(server, { start, exchange, config,
    language: prepared.language, components });
}
