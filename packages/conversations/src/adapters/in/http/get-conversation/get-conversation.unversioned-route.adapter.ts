import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Logger } from '../../logger.js';
import type { GetConversationHandler } from './get-conversation.handler.js';
import { getConversationParamsSchema, type GetConversationParams } from './get-conversation.schemas.js';

type Language = 'en' | 'it';

const messages = {
  missing: { en: 'Conversation not found.', it: 'Conversazione non trovata.' },
  failure: { en: "I can't complete the response.", it: 'Non riesco a completare la risposta.' },
} as const;

function publicError(reply: FastifyReply, status: number, message: string): FastifyReply {
  return reply.code(status).header('Cache-Control', 'no-store').type('application/json').send({ error: message });
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown conversation history failure', { cause: value });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled history outcome ${JSON.stringify(value)}`);
}

/**
 * `GET /conversations/:conversationId` of the API without a version, kept while a client release uses it
 * («Risposta HTTP dello storico conversazionale nell'API senza versione»).
 */
export function registerUnversionedGetConversationRoute(scope: FastifyInstance, handle: GetConversationHandler,
  language: Language, log: Logger): void {
  scope.get<{ Params: GetConversationParams }>('/conversations/:conversationId', {
    schema: { params: getConversationParamsSchema },
    errorHandler(error, _request, reply) {
      if (error.validation) return publicError(reply, 400, 'Invalid HTTP request.');
      throw error;
    },
  }, async (request, reply) => {
    try {
      const outcome = await handle(request.params);
      switch (outcome.kind) {
        case 'conversation':
          return reply.code(200).header('Cache-Control', 'no-store').type('application/json').send(outcome.body);
        case 'conversation_not_found':
          return publicError(reply, 404, messages.missing[language]);
        default:
          return assertNever(outcome);
      }
    } catch (error) {
      log.child({ correlationId: request.id }).error({ event: 'conversation_history_http_failed', err: normalizeError(error) },
        'HTTP request failed');
      return publicError(reply, 500, messages.failure[language]);
    }
  });
}
