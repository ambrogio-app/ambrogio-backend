import { ProjectError } from '../../../domain/project-error.js';
import { sql, type Kysely } from 'kysely';
import type { TurnId } from '../../../domain/identities.js';
import type { Result } from '../../../domain/result.js';
import type { Turn } from '../../../domain/turn/turn.js';
import type {
  AdmissionRejection, TurnAdmission, TurnAlreadyClosed, TurnRepository,
} from '../../../application/turn-repository.port.js';
import type { ConversationDatabase } from './conversation-archive.js';
import { conclusionColumns, rehydrateTurn, toInstant } from './postgres-turn-mapper.js';
import { isLockNotAvailable, withWriteTransaction } from './postgres-transaction.js';

/** Signals, inside the admission transaction, that the conversation row lock was not obtained in time. */
class AdmissionLockBusy extends Error {}

/** Loads and saves the turn aggregate; the Domain decides every state, this adapter only stores it. */
export class PostgresTurnRepository implements TurnRepository {
  readonly #db: Kysely<ConversationDatabase>;

  constructor(db: Kysely<ConversationDatabase>) {
    this.#db = db;
  }

  async admit({ turn, conversation }: TurnAdmission): Promise<Result<void, AdmissionRejection>> {
    if (turn.status !== 'pending') throw new ProjectError('Only pending turns can be admitted');
    const turnId = turn.id.value;
    const conversationId = turn.conversationId.value;
    const acceptedAt = toInstant(turn.acceptedAt);
    try {
      return await withWriteTransaction(this.#db, async db => {
        if (conversation === 'existing') {
          // The row lock is held from this decisional read to the commit.
          let stored;
          try {
            stored = await db.selectFrom('conversations').select(['id', 'active_turn_id'])
              .where('id', '=', conversationId).forUpdate().executeTakeFirst();
          } catch (error) {
            if (isLockNotAvailable(error)) throw new AdmissionLockBusy('Conversation lock not available', { cause: error });
            throw error;
          }
          if (!stored) throw new ProjectError('Conversation record missing for admission');
          if (stored.active_turn_id !== null) return { ok: false, error: { kind: 'conversation_occupied' } };
        } else {
          await db.insertInto('conversations').values({
            id: conversationId, created_at: acceptedAt, last_activity_at: acceptedAt, active_turn_id: null,
          }).execute();
        }
        const ordinalResult = await db.selectFrom('turns')
          .select(sql<number>`coalesce(max(ordinal), 0)::integer`.as('last'))
          .where('conversation_id', '=', conversationId).executeTakeFirstOrThrow();
        await db.insertInto('turns').values({
          id: turnId, conversation_id: conversationId, text: turn.text, ordinal: ordinalResult.last + 1,
          accepted_at: acceptedAt, status: 'pending', answer: null, error: null, finished_at: null,
          agent: null, actions: null,
        }).execute();
        const occupied = await db.updateTable('conversations')
          .set({ active_turn_id: turnId, last_activity_at: acceptedAt })
          .where('id', '=', conversationId).where('active_turn_id', 'is', null).executeTakeFirst();
        if (occupied.numUpdatedRows !== 1n) throw new ProjectError('Conversation admission postcondition failed');
        return { ok: true, value: undefined };
      });
    } catch (error) {
      if (error instanceof AdmissionLockBusy) return { ok: false, error: { kind: 'archive_busy' } };
      throw error;
    }
  }

  /** Turn, own conversation and occupying conversations in one statement, so the check sees one state. */
  #loadRows() {
    return this.#db.selectFrom('turns')
      .leftJoin('conversations as own', 'own.id', 'turns.conversation_id')
      .selectAll('turns')
      .select(['own.id as own_conversation', 'own.active_turn_id as own_active_turn'])
      .select(eb => eb.selectFrom('conversations as holder')
        .select(eb.fn.countAll<string>().as('holders'))
        .whereRef('holder.active_turn_id', '=', 'turns.id')
        .as('holders'));
  }

  async find(id: TurnId): Promise<Turn | undefined> {
    const rows = await this.#loadRows().where('turns.id', '=', id.value).execute();
    if (rows.length === 0) return undefined;
    if (rows.length > 1) throw new ProjectError('Duplicated persisted turn');
    return loadedTurn(rows[0]!);
  }

  async findPending(): Promise<readonly Turn[]> {
    const rows = await this.#loadRows().where('turns.status', '=', 'pending')
      .orderBy('turns.accepted_at', 'asc').orderBy('turns.id', 'asc').execute();
    return rows.map(row => loadedTurn(row));
  }

  async saveConclusion(turn: Turn): Promise<Result<void, TurnAlreadyClosed>> {
    const columns = conclusionColumns(turn);
    const turnId = turn.id.value;
    const conversationId = turn.conversationId.value;
    return withWriteTransaction(this.#db, async db => {
      // The expected version is the stored pending state, compared and changed by this one statement:
      // under READ COMMITTED a statement that waited for a competitor re-evaluates it on the committed row.
      const updated = await db.updateTable('turns').set(columns)
        .where('id', '=', turnId).where('status', '=', 'pending').executeTakeFirst();
      if (updated.numUpdatedRows === 0n) {
        const stored = await db.selectFrom('turns').select('status').where('id', '=', turnId).executeTakeFirst();
        if (stored && stored.status !== 'pending') return { ok: false, error: { kind: 'turn_already_closed' } };
        throw new ProjectError('Turn conclusion postcondition failed');
      }
      if (updated.numUpdatedRows !== 1n) throw new ProjectError('Turn conclusion postcondition failed');
      const released = await db.updateTable('conversations').set({ active_turn_id: null })
        .where('id', '=', conversationId).where('active_turn_id', '=', turnId).executeTakeFirst();
      if (released.numUpdatedRows !== 1n) throw new ProjectError('Conversation release postcondition failed');
      return { ok: true, value: undefined };
    });
  }
}

function loadedTurn(row: Parameters<typeof rehydrateTurn>[0] & Readonly<{
  own_conversation: string | null; own_active_turn: string | null; holders: string | number | bigint | null;
}>): Turn {
  if (row.own_conversation === null) throw new ProjectError('Conversation record missing for turn');
  const turn = rehydrateTurn(row);
  const holders = Number(row.holders ?? 0);
  const occupiedByOwn = row.own_active_turn === row.id;
  const consistent = turn.status === 'pending' ? holders === 1 && occupiedByOwn : holders === 0;
  if (!consistent) throw new ProjectError('Inconsistent conversation occupancy for turn');
  return turn;
}
