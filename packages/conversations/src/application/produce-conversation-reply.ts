import type { ConversationHistory } from './conversation-history-read.js';

/**
 * One produced element of a reply: the agent formulating it, a new text increment or the
 * structured reply expectation.
 */
export type ReplyPart =
  | Readonly<{ kind: 'agent'; agent: string }>
  | Readonly<{ kind: 'text'; text: string }>
  | Readonly<{ kind: 'reply_expectation'; expectsReply: boolean }>;

/**
 * Produces the reply of an admitted turn from its persisted conversation context; the signal is
 * aborted when the reply must stop, so requests still in flight can be cancelled.
 */
export interface ProduceConversationReply {
  produce(history: ConversationHistory, signal: AbortSignal): AsyncIterable<ReplyPart>;
}
