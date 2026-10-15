import type { ConversationListCursor, ConversationListPage, ConversationListRead } from './conversation-list-read.js';

export type ListConversations = (input: Readonly<{
  after?: ConversationListCursor;
  limit?: number;
}>) => Promise<ConversationListPage>;

/** The composition root supplies limits loaded from the conversation component's JSON file. */
export function createListConversations(
  read: ConversationListRead, pageSize = 20, maxPageSize = 100,
): ListConversations {
  if (!Number.isSafeInteger(maxPageSize) || maxPageSize < 1
    || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
    throw new Error('Invalid conversation page size');
  }
  return ({ after, limit }) => {
    const size = limit ?? pageSize;
    if (!Number.isSafeInteger(size) || size < 1 || size > maxPageSize) {
      throw new Error('Invalid conversation page size');
    }
    return read.page(after, size);
  };
}
