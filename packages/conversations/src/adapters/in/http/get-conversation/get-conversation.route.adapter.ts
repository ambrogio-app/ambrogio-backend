import type { FastifyInstance } from 'fastify';
import { rejectOtherMethods, sendProblem } from '../problem-details.js';
import type { GetConversationHandler } from './get-conversation.handler.js';
import { conversationNotFoundProblem, getConversationParamsSchema,
  type GetConversationParams } from './get-conversation.schemas.js';

function assertNever(value: never): never {
  throw new Error(`Unhandled history outcome ${JSON.stringify(value)}`);
}

/** `GET /conversations/:conversationId` of the versioned API («Risposta HTTP dello storico conversazionale»). */
export function registerGetConversationRoute(scope: FastifyInstance, handle: GetConversationHandler): void {
  scope.get<{ Params: GetConversationParams }>('/conversations/:conversationId', {
    schema: { params: getConversationParamsSchema },
  }, async (request, reply) => {
    const outcome = await handle(request.params);
    switch (outcome.kind) {
      case 'conversation':
        return reply.code(200).header('Cache-Control', 'no-store').type('application/json').send(outcome.body);
      case 'conversation_not_found':
        return sendProblem(reply, conversationNotFoundProblem);
      default:
        return assertNever(outcome);
    }
  });
  rejectOtherMethods(scope, '/conversations/:conversationId');
}
