import type { ConversationHistory, HistoryAction } from './conversation-history-read.port.js';

/**
 * One produced element of a reply: the agent formulating it, a new text increment, a concluded MCP tool
 * call of the agent or the structured reply expectation.
 */
export type ReplyPart =
  | Readonly<{ kind: 'agent'; agent: string }>
  | Readonly<{ kind: 'text'; text: string }>
  | Readonly<{ kind: 'action'; action: HistoryAction }>
  | Readonly<{ kind: 'reply_expectation'; expectsReply: boolean }>;

/** `requested` resolves when the reply must stop, so the producer cancels its requests in flight. */
export type ReplyCancellation = Readonly<{ requested: Promise<void> }>;

/** Produces the reply of an admitted turn from its persisted conversation context. */
export interface ProduceConversationReply {
  produce(history: ConversationHistory, cancellation: ReplyCancellation): AsyncIterable<ReplyPart>;
}
