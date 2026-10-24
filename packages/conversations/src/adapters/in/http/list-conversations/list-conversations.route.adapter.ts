import type { FastifyInstance } from 'fastify';
import { rejectOtherMethods, sendProblem } from '../problem-details.js';
import type { ListConversationsHandler } from './list-conversations.handler.js';
import { invalidPaginationProblem, listConversationsQuerySchema,
  type ListConversationsQuery } from './list-conversations.schemas.js';

function assertNever(value: never): never {
  throw new Error(`Unhandled list outcome ${JSON.stringify(value)}`);
}

/** `GET /conversations` of the versioned API («Risposta HTTP dell'elenco conversazioni»). */
export function registerListConversationsRoute(scope: FastifyInstance, handle: ListConversationsHandler): void {
  scope.get<{ Querystring: ListConversationsQuery }>('/conversations', {
    schema: { querystring: listConversationsQuerySchema },
  }, async (request, reply) => {
    const outcome = await handle(request.query);
    switch (outcome.kind) {
      case 'page':
        return reply.code(200).header('Cache-Control', 'no-store').type('application/json').send(outcome.body);
      case 'invalid_pagination':
        return sendProblem(reply, invalidPaginationProblem);
      default:
        return assertNever(outcome);
    }
  });
  rejectOtherMethods(scope, '/conversations');
}
