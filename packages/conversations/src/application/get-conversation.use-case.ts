import type { Result, TurnSnapshot } from '../domain/turn.js';
import type { ConversationHistoryRead } from './conversation-history-read.js';

export type GetConversationInput = Readonly<{ conversationId: string }>;
export type GetConversationRejection = Readonly<{ kind: 'conversation_not_found' }>;
/** A stored turn as consulted by clients: the responding agent stays internal. */
export type ConversationTurnView = DistributiveOmit<TurnSnapshot, 'agent'>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
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
    return { ok: true, value: { ...found, turns: found.turns.map(withoutAgent) } };
  };
}

function withoutAgent(turn: TurnSnapshot): ConversationTurnView {
  if (turn.status !== 'answered') return turn;
  const { agent: _agent, ...view } = turn;
  return view;
}
