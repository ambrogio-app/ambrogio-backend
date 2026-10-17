import type { ConversationHistory } from './conversation-history-read.js';

/** One produced element of a reply: a new text increment or the structured reply expectation. */
export type ReplyPart =
  | Readonly<{ kind: 'text'; text: string }>
  | Readonly<{ kind: 'reply_expectation'; expectsReply: boolean }>;

/** Produces the reply of an admitted turn from its persisted conversation context. */
export interface ProduceConversationReply {
  produce(history: ConversationHistory): AsyncIterable<ReplyPart>;
}
