import type { ConversationHistory } from './conversation-history-read.js';

/** Produces text increments for an admitted turn using its persisted conversation context. */
export type VoiceReplyPart = string | Readonly<{ kind: 'reply_expectation'; expectsReply: boolean }>;

export interface ProduceConversationReply {
  produce(history: ConversationHistory): AsyncIterable<string>;
  produceVoice?(history: ConversationHistory): AsyncIterable<VoiceReplyPart>;
}
