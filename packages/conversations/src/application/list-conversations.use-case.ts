import type { ConversationListCursor, ConversationListPage, ConversationListRead } from './conversation-list-read.js';

export type ListConversations = (input: Readonly<{ after?: ConversationListCursor }>) => Promise<ConversationListPage>;

/** Page size is a composition choice until an ingress defines its public contract. */
export function createListConversations(read: ConversationListRead, pageSize = 20): ListConversations {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error('Invalid conversation page size');
  }
  return ({ after }) => read.page(after, pageSize);
}
