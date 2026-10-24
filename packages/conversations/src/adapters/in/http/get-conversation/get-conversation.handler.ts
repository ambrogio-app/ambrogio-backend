import type { ConversationTurnView, ConversationView, GetConversation,
  GetConversationRejection } from '../../../../application/get-conversation.use-case.js';
import type { ConversationBody, ConversationTurnBody, GetConversationParams } from './get-conversation.schemas.js';

export type GetConversationOutcome =
  | Readonly<{ kind: 'conversation'; body: ConversationBody }>
  | GetConversationRejection;

export type GetConversationHandler = (params: GetConversationParams) => Promise<GetConversationOutcome>;

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
export function createGetConversationHandler(getConversation: GetConversation): GetConversationHandler {
  return async params => {
    const result = await getConversation({ conversationId: params.conversationId });
    if (!result.ok) return result.error;
    return { kind: 'conversation', body: toBody(result.value) };
  };
}
