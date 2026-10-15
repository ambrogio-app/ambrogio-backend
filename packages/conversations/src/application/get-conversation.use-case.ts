import type { Result, TurnSnapshot } from '../domain/turn.js';
import type { ConversationHistoryRead } from './conversation-history-read.js';

export type GetConversationInput = Readonly<{ conversationId: string }>;
export type GetConversationRejection = Readonly<{ kind: 'conversation_not_found' }>;
export type ConversationTurnView = TurnSnapshot;
export type ConversationView = Readonly<{
  id: string;
  createdAt: Date;
  lastActivityAt: Date;
  turns: readonly ConversationTurnView[];
}>;
export type GetConversation = (input: GetConversationInput) => Promise<Result<ConversationView, GetConversationRejection>>;

export function createGetConversation(history: ConversationHistoryRead): GetConversation {
  return async ({ conversationId }) => {
    const found = await history.find(conversationId);
    if (!found) return { ok: false, error: { kind: 'conversation_not_found' } };
    return { ok: true, value: found };
  };
}
