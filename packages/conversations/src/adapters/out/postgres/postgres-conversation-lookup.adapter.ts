import type { Kysely } from 'kysely';
import type { ConversationId } from '../../../domain/identities.js';
import type { ConversationLookup } from '../../../application/conversation-lookup.port.js';
import type { ConversationDatabase } from './conversation-archive.js';

export class PostgresConversationLookup implements ConversationLookup {
  readonly #db: Kysely<ConversationDatabase>;

  constructor(db: Kysely<ConversationDatabase>) {
    this.#db = db;
  }

  async exists(id: ConversationId): Promise<boolean> {
    const row = await this.#db.selectFrom('conversations').select('id').where('id', '=', id.value).executeTakeFirst();
    return row !== undefined;
  }
}
