import { ProjectError } from '../../../project-error.js';
import { sql, type Kysely } from 'kysely';
import type {
  ConversationListCursor, ConversationListPage, ConversationListRead,
} from '../../../application/conversation-list-read.port.js';
import type { ConversationDatabase } from './schema.js';
import { fromMillis, toMillis } from './sqlite-turn-mapper.js';

export class SqliteConversationListRead implements ConversationListRead {
  constructor(private readonly db: Kysely<ConversationDatabase>, private readonly maxPageSize = 100) {
    if (!Number.isSafeInteger(maxPageSize) || maxPageSize < 1) {
      throw new ProjectError('Invalid conversation page size');
    }
  }

  async page(after: ConversationListCursor | undefined, limit: number): Promise<ConversationListPage> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.maxPageSize) {
      throw new ProjectError('Invalid conversation page size');
    }
    let query = this.db.selectFrom('conversations').select(['id', 'last_activity_at']);
    if (after) {
      if (typeof after.id !== 'string' || after.id.length === 0) throw new ProjectError('Invalid conversation cursor');
      const instant = toMillis(after.lastActivityAt);
      query = query.where(sql<boolean>`last_activity_at < ${instant} or
        (last_activity_at = ${instant} and id < ${after.id})`);
    }
    const rows = await query.orderBy('last_activity_at', 'desc').orderBy('id', 'desc')
      .limit(limit + 1).execute();
    const items = rows.slice(0, limit).map(row => ({
      id: row.id,
      lastActivityAt: fromMillis(row.last_activity_at),
    }));
    const last = items.at(-1);
    return rows.length > limit && last
      ? { items, next: { id: last.id, lastActivityAt: new Date(last.lastActivityAt.getTime()) } }
      : { items };
  }
}
