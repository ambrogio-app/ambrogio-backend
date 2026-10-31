import type { FastifyInstance } from 'fastify';
import type { ConversationTurnView, ConversationView, GetConversation,
  GetConversationRejection } from '../../../../application/get-conversation/get-conversation.use-case.js';
import { rejectOtherMethods, sendProblem } from '../problem-details.js';
import { conversationNotFoundProblem, getConversationParamsSchema, type ConversationBody, type ConversationTurnBody,
  type GetConversationParams } from './get-conversation.schemas.js';

type GetConversationOutcome =
  | Readonly<{ kind: 'conversation'; body: ConversationBody }>
  | GetConversationRejection;

function assertNever(value: never): never {
  throw new Error(`Unhandled history outcome ${JSON.stringify(value)}`);
}

function toTurnBody(turn: ConversationTurnView): ConversationTurnBody {
  const base = { id: turn.id, text: turn.text, acceptedAt: turn.acceptedAt.toISOString() };
  switch (turn.status) {
    case 'pending': return { ...base, status: 'pending' };
    case 'answered':
      return { ...base, status: 'answered', answer: turn.answer, finishedAt: turn.finishedAt.toISOString() };
    case 'failed':
      return { ...base, status: 'failed', error: turn.error, finishedAt: turn.finishedAt.toISOString() };
    case 'interrupted': return { ...base, status: 'interrupted', finishedAt: turn.finishedAt.toISOString() };
  }
}

function toBody(conversation: ConversationView): ConversationBody {
  return {
    id: conversation.id,
    createdAt: conversation.createdAt.toISOString(),
    lastActivityAt: conversation.lastActivityAt.toISOString(),
    turns: conversation.turns.map(toTurnBody),
  };
}

/** Translate a history request into the use case and its snapshot into the public representation. */
async function readConversation(getConversation: GetConversation,
  params: GetConversationParams): Promise<GetConversationOutcome> {
  const result = await getConversation({ conversationId: params.conversationId });
  if (!result.ok) return result.error;
  return { kind: 'conversation', body: toBody(result.value) };
}

/** `GET /conversations/:conversationId` of the versioned API («Risposta HTTP dello storico conversazionale»). */
export function registerGetConversationRoute(scope: FastifyInstance, getConversation: GetConversation): void {
  scope.get<{ Params: GetConversationParams }>('/conversations/:conversationId', {
    schema: { params: getConversationParamsSchema },
  }, async (request, reply) => {
    const outcome = await readConversation(getConversation, request.params);
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
