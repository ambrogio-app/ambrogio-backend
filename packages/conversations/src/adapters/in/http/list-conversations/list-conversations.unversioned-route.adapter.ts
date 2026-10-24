import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ListConversationsHandler } from './list-conversations.handler.js';
import { listConversationsQuerySchema, type ListConversationsQuery } from './list-conversations.schemas.js';

type Language = 'en' | 'it';

const messages = {
  invalid: { en: 'Invalid pagination request.', it: 'Richiesta di paginazione non valida.' },
  failure: { en: "I can't complete the response.", it: 'Non riesco a completare la risposta.' },
} as const;

function publicError(reply: FastifyReply, status: number, message: string): FastifyReply {
  return reply.code(status).header('Cache-Control', 'no-store').type('application/json').send({ error: message });
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown conversation list failure', { cause: value });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled list outcome ${JSON.stringify(value)}`);
}

/**
 * `GET /conversations` of the API without a version, kept while a client release uses it
 * («Risposta HTTP dell'elenco conversazioni nell'API senza versione»).
 */
export function registerUnversionedListConversationsRoute(scope: FastifyInstance, handle: ListConversationsHandler,
  language: Language): void {
  scope.get<{ Querystring: ListConversationsQuery }>('/conversations', {
    schema: { querystring: listConversationsQuerySchema },
    errorHandler(error, request, reply) {
      if (error.statusCode === 400) return publicError(reply, 400, messages.invalid[language]);
      request.log.error({ event: 'conversation_list_http_failed', err: normalizeError(error) },
        'HTTP request failed');
      return publicError(reply, 500, messages.failure[language]);
    },
  }, async (request, reply) => {
    try {
      const outcome = await handle(request.query);
      switch (outcome.kind) {
        case 'page':
          return reply.code(200).header('Cache-Control', 'no-store').type('application/json').send(outcome.body);
        case 'invalid_pagination':
          return publicError(reply, 400, messages.invalid[language]);
        default:
          return assertNever(outcome);
      }
    } catch (error) {
      request.log.error({ event: 'conversation_list_http_failed', err: normalizeError(error) },
        'HTTP request failed');
      return publicError(reply, 500, messages.failure[language]);
    }
  });
}
