import { ProjectError } from '../domain/project-error.js';
import type { ConversationMemorySearch, MemoryMatch, MemorySearchQuery } from './conversation-memory-search.port.js';

export type SearchConversations = (query: MemorySearchQuery) => Promise<readonly MemoryMatch[]>;

/** Upper bound of the results of one search («Strumento MCP search_conversations»). */
export const maxMemoryResults = 20;

/** Searches the answered turns of the family's conversations; the inbound adapter has checked the arguments. */
export function createSearchConversations(memory: ConversationMemorySearch): SearchConversations {
  return query => {
    if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > maxMemoryResults) {
      throw new ProjectError('Invalid memory search limit');
    }
    return memory.search(query);
  };
}
