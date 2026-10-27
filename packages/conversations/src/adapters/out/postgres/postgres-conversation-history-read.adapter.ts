import { ProjectError } from '../../../domain/project-error.js';
import { ConversationId } from '../../../domain/identities.js';
import type { Kysely } from 'kysely';
import type { ConversationHistory, ConversationHistoryRead } from '../../../application/conversation-history-read.port.js';
import type { ConversationDatabase } from './conversation-archive.js';
import { fromInstant, toHistoryTurn } from './postgres-turn-mapper.js';

export class PostgresConversationHistoryRead implements ConversationHistoryRead {
  readonly #db: Kysely<ConversationDatabase>;

  constructor(db: Kysely<ConversationDatabase>) {
    this.#db = db;
  }

  async find(conversationId: string): Promise<ConversationHistory | undefined> {
    // Every stored conversation has a UUID v4 identity: another value identifies none.
    if (!ConversationId.isValid(conversationId)) return undefined;
    const conversation = await this.#db.selectFrom('conversations').selectAll()
      .where('id', '=', conversationId).executeTakeFirst();
    if (!conversation) return undefined;
    const turns = await this.#db.selectFrom('turns').selectAll()
      .where('conversation_id', '=', conversationId).orderBy('ordinal', 'asc').execute();
    for (let index = 0; index < turns.length; index += 1) {
      if (turns[index]?.ordinal !== index + 1) throw new ProjectError('Invalid persisted turn order');
    }
    return {
      id: conversation.id,
      createdAt: fromInstant(conversation.created_at),
      lastActivityAt: fromInstant(conversation.last_activity_at),
      turns: turns.map(row => toHistoryTurn(row)),
    };
  }
}
