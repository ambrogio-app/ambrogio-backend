/** A search in the memory of the conversations («Strumento MCP search_conversations»). */
export type MemorySearchQuery = Readonly<{
  /** The words to find, in the syntax of PostgreSQL `websearch_to_tsquery`. */
  text: string;
  /** First and last calendar day, `YYYY-MM-DD` in the family's time zone, both included. */
  from?: string;
  to?: string;
  limit: number;
}>;

/** An answered turn that matches, most relevant first. */
export type MemoryMatch = Readonly<{
  conversationId: string;
  turnId: string;
  acceptedAt: Date;
  question: string;
  answer: string;
}>;

/** A read of the answered turns of every stored conversation; it never writes. */
export interface ConversationMemorySearch {
  search(query: MemorySearchQuery): Promise<readonly MemoryMatch[]>;
}
