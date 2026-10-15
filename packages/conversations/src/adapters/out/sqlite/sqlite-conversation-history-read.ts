import { ProjectError } from '../../../project-error.js';
import type { Kysely } from 'kysely';
import type { ConversationHistory, ConversationHistoryRead } from '../../../application/conversation-history-read.js';
import type { ConversationDatabase } from './schema.js';
import { fromMillis, restoreTurn } from './sqlite-turn-mapper.js';

export class SqliteConversationHistoryRead implements ConversationHistoryRead {
  constructor(private readonly db: Kysely<ConversationDatabase>) {}

  async find(conversationId: string): Promise<ConversationHistory | undefined> {
    const conversation = await this.db.selectFrom('conversations').selectAll()
      .where('id', '=', conversationId).executeTakeFirst();
    if (!conversation) return undefined;
    const turns = await this.db.selectFrom('turns').selectAll()
      .where('conversation_id', '=', conversationId).orderBy('ordinal', 'asc').execute();
    for (let index = 0; index < turns.length; index += 1) {
      if (turns[index]?.ordinal !== index + 1) throw new ProjectError('Invalid persisted turn order');
    }
    return {
      id: conversation.id,
      createdAt: fromMillis(conversation.created_at),
      lastActivityAt: fromMillis(conversation.last_activity_at),
      turns: turns.map(row => restoreTurn(row).snapshot()),
    };
  }
}
