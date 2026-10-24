import type { TurnSnapshot } from '../domain/turn.js';

export type ConversationHistory = Readonly<{
  id: string;
  createdAt: Date;
  lastActivityAt: Date;
  turns: readonly TurnSnapshot[];
}>;

/** Historical reads remain separate from the admission/completion writer. */
export interface ConversationHistoryRead {
  find(conversationId: string): Promise<ConversationHistory | undefined>;
}
