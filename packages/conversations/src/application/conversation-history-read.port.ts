type HistoryTurnBase = Readonly<{ id: string; text: string; acceptedAt: Date }>;

/** A stored turn as read for history and reply context, independent of the Domain `Turn`. */
export type HistoryTurn =
  | (HistoryTurnBase & Readonly<{ status: 'pending' }>)
  | (HistoryTurnBase & Readonly<{ status: 'answered'; answer: string; finishedAt: Date;
    /** The agent that formulated the answer, when known. */
    agent?: string }>)
  | (HistoryTurnBase & Readonly<{ status: 'failed'; error: string; finishedAt: Date }>)
  | (HistoryTurnBase & Readonly<{ status: 'interrupted'; finishedAt: Date }>);

export type ConversationHistory = Readonly<{
  id: string;
  createdAt: Date;
  lastActivityAt: Date;
  turns: readonly HistoryTurn[];
}>;

/** Historical reads remain separate from the turn repository and from the lookup port. */
export interface ConversationHistoryRead {
  find(conversationId: string): Promise<ConversationHistory | undefined>;
}
