import { sql, type Kysely } from 'kysely';
import { ProjectError } from '../../../domain/project-error.js';
import type {
  ConversationMemorySearch, MemoryMatch, MemorySearchQuery,
} from '../../../application/conversation-memory-search.port.js';
import type { ConversationDatabase } from './conversation-archive.js';
import { fromInstant } from './postgres-turn-mapper.js';

/** The text search configuration of each language of the installation («Indici full-text dei turni»). */
const configurations = { it: 'italian', en: 'english' } as const;

/** Full-text search of the answered turns; the expression matches the index of the language. */
export class PostgresConversationMemorySearch implements ConversationMemorySearch {
  readonly #db: Kysely<ConversationDatabase>;
  readonly #configuration: string;
  readonly #timeZone: string;

  constructor(db: Kysely<ConversationDatabase>, language: 'it' | 'en', timeZone: string) {
    this.#db = db;
    this.#configuration = configurations[language];
    this.#timeZone = timeZone;
  }

  async search(query: MemorySearchQuery): Promise<readonly MemoryMatch[]> {
    // A literal configuration, so that the planner recognizes the expression of the partial index.
    const configuration = sql.lit(this.#configuration);
    const document = sql`to_tsvector(${configuration}, text || ' ' || answer)`;
    const words = sql`websearch_to_tsquery(${configuration}, ${query.text})`;
    const day = sql`(accepted_at at time zone ${this.#timeZone})::date`;
    let select = this.#db.selectFrom('turns')
      .select(['id', 'conversation_id', 'accepted_at', 'text', 'answer'])
      .where('status', '=', 'answered')
      .where(sql<boolean>`${document} @@ ${words}`);
    if (query.from !== undefined) select = select.where(sql<boolean>`${day} >= ${query.from}::date`);
    if (query.to !== undefined) select = select.where(sql<boolean>`${day} <= ${query.to}::date`);
    const rows = await select
      .orderBy(sql`ts_rank_cd(${document}, ${words})`, 'desc')
      .orderBy('accepted_at', 'desc').orderBy('id', 'asc')
      .limit(query.limit).execute();
    return rows.map(row => {
      // An answered turn always has its answer: anything else is incompatible persisted data.
      if (row.answer === null) throw new ProjectError('Invalid persisted turn state');
      return { conversationId: row.conversation_id, turnId: row.id,
        acceptedAt: fromInstant(row.accepted_at), question: row.text, answer: row.answer };
    });
  }
}
