import type { ConversationListCursor, ConversationListPage } from '../../../../application/conversation-list-read.port.js';
import type { ListConversations } from '../../../../application/list-conversations.use-case.js';
import type { ConversationPageBody, ListConversationsQuery } from './list-conversations.schemas.js';

export type ListConversationsOutcome =
  | Readonly<{ kind: 'page'; body: ConversationPageBody }>
  | Readonly<{ kind: 'invalid_pagination' }>;

export type ListConversationsHandler = (query: ListConversationsQuery) => Promise<ListConversationsOutcome>;

function encodeCursor(cursor: ConversationListCursor): string {
  return Buffer.from(JSON.stringify({ id: cursor.id, lastActivityAt: cursor.lastActivityAt.toISOString() }), 'utf8')
    .toString('base64url');
}

function decodeCursor(value: string): ConversationListCursor | undefined {
  if (value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.toString('base64url') !== value) return undefined;
    const json = decoded.toString('utf8');
    if (!Buffer.from(json, 'utf8').equals(decoded)) return undefined;
    const cursor: unknown = JSON.parse(json);
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    const fields = cursor as Record<string, unknown>;
    if (Object.keys(fields).length !== 2 || typeof fields.id !== 'string' || fields.id.length === 0
      || typeof fields.lastActivityAt !== 'string') return undefined;
    const lastActivityAt = new Date(fields.lastActivityAt);
    if (!Number.isFinite(lastActivityAt.getTime())
      || lastActivityAt.toISOString() !== fields.lastActivityAt) return undefined;
    return { id: fields.id, lastActivityAt };
  } catch {
    return undefined;
  }
}

/** Convert the accepted query into the use case input; undefined when the cursor or the limit is not acceptable. */
function toInput(query: ListConversationsQuery, maxPageSize: number):
  Readonly<{ after?: ConversationListCursor; limit?: number }> | undefined {
  const input: { after?: ConversationListCursor; limit?: number } = {};
  if (query.cursor !== undefined) {
    const after = decodeCursor(query.cursor);
    if (!after) return undefined;
    input.after = after;
  }
  if (query.limit !== undefined) {
    if (!/^[0-9]+$/.test(query.limit)) return undefined;
    const limit = Number(query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxPageSize) return undefined;
    input.limit = limit;
  }
  return input;
}

function toBody(page: ConversationListPage): ConversationPageBody {
  return {
    items: page.items.map(item => ({ id: item.id, lastActivityAt: item.lastActivityAt.toISOString() })),
    nextCursor: page.next ? encodeCursor(page.next) : null,
  };
}

/** Translate a page request into the list use case and its page into the public representation. */
export function createListConversationsHandler(dependencies: Readonly<{
  listConversations: ListConversations;
  maxPageSize: number;
}>): ListConversationsHandler {
  return async query => {
    const input = toInput(query, dependencies.maxPageSize);
    if (!input) return { kind: 'invalid_pagination' };
    return { kind: 'page', body: toBody(await dependencies.listConversations(input)) };
  };
}
