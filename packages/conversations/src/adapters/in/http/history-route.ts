import type { FastifyInstance, FastifyReply } from 'fastify';
import type { GetConversation } from '../../../application/get-conversation.use-case.js';

type Language = 'en' | 'it';

const messages = {
  missing: { en: 'Conversation not found.', it: 'Conversazione non trovata.' },
  failure: { en: "I can't complete the response.", it: 'Non riesco a completare la risposta.' },
} as const;

function publicError(reply: FastifyReply, status: number, message: string): FastifyReply {
  return reply.code(status).header('Cache-Control', 'no-store').type('application/json').send({ error: message });
}

/** Serve one persisted conversation snapshot for a manual chat reopening. */
export function registerHistoryRoute(server: FastifyInstance, options: Readonly<{
  getConversation: GetConversation;
  language: Language;
}>): void {
  server.get<{ Params: { conversationId: string } }>('/api/conversations/:conversationId', async (request, reply) => {
    try {
      const result = await options.getConversation({ conversationId: request.params.conversationId });
      if (!result.ok) return publicError(reply, 404, messages.missing[options.language]);
      return reply.code(200).header('Cache-Control', 'no-store')
        .type('application/json').send(result.value);
    } catch (error) {
      request.log.error({ event: 'conversation_history_http_failed', err: error }, 'HTTP request failed');
      return publicError(reply, 500, messages.failure[options.language]);
    }
  });
}
