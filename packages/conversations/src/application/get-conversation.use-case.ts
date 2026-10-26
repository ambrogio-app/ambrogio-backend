import type { Result } from '../domain/result.js';
import type { ConversationHistoryRead, HistoryTurn } from './conversation-history-read.port.js';

export type GetConversationInput = Readonly<{ conversationId: string }>;
export type GetConversationRejection = Readonly<{ kind: 'conversation_not_found' }>;
/** A stored turn as consulted by clients: the responding agent and its actions stay internal. */
export type ConversationTurnView = DistributiveOmit<HistoryTurn, 'agent' | 'actions'>;
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

function withoutAgent(turn: HistoryTurn): ConversationTurnView {
  if (turn.status !== 'answered') return turn;
  const { agent: _agent, actions: _actions, ...view } = turn;
  return view;
}
