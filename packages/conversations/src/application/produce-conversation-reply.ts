import type { ConversationHistory } from './conversation-history-read.js';

/** Produces text increments for an admitted turn using its persisted conversation context. */
export interface ProduceConversationReply {
  produce(history: ConversationHistory): AsyncIterable<string>;
}
