/** A JSON value, as exchanged with an MCP tool. */
export type HistoryJsonValue = null | boolean | number | string | readonly HistoryJsonValue[]
  | { readonly [key: string]: HistoryJsonValue };

/** A stored call of the answering agent to an MCP tool, with the returned value or the error message. */
export type HistoryAction = Readonly<{ tool: string; input: Readonly<Record<string, HistoryJsonValue>> }>
  & (Readonly<{ output: HistoryJsonValue; error?: never }> | Readonly<{ error: string; output?: never }>);

type HistoryTurnBase = Readonly<{ id: string; text: string; acceptedAt: Date }>;

/** A stored turn as read for history and reply context, independent of the Domain `Turn`. */
export type HistoryTurn =
  | (HistoryTurnBase & Readonly<{ status: 'pending' }>)
  | (HistoryTurnBase & Readonly<{ status: 'answered'; answer: string; finishedAt: Date;
    /** The agent that formulated the answer, when known. */
    agent?: string;
    /** The MCP tool calls of the answering agent, when there were any. */
    actions?: readonly HistoryAction[] }>)
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
