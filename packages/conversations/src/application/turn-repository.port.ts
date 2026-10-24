import type { TurnId } from '../domain/identities.js';
import type { Result } from '../domain/result.js';
import type { Turn } from '../domain/turn.js';

export type ConversationOccupied = Readonly<{ kind: 'conversation_occupied' }>;
export type ArchiveBusy = Readonly<{ kind: 'archive_busy' }>;
export type AdmissionRejection = ConversationOccupied | ArchiveBusy;
export type TurnAlreadyClosed = Readonly<{ kind: 'turn_already_closed' }>;

export type TurnAdmission = Readonly<{
  turn: Turn;
  /** `new` creates the conversation of the turn; `existing` continues one found by the lookup port. */
  conversation: 'new' | 'existing';
}>;

/**
 * The lifecycle of the `Turn` aggregate: it loads and saves, and never decides a Domain transition.
 *
 * Concurrency guarantees («Garanzie di concorrenza del repository del turno»):
 * - `admit` admits at most one pending turn per conversation, across connections and processes; a held
 *   occupancy is `conversation_occupied`, a write lock that is not available at once is `archive_busy`.
 * - `saveConclusion` saves an outcome only while the stored turn is still pending (expected version),
 *   together with the release of the occupancy; a turn closed meanwhile is `turn_already_closed`.
 * Any other failure is an unexpected fault and is never retried.
 */
export interface TurnRepository {
  admit(input: TurnAdmission): Promise<Result<void, AdmissionRejection>>;
  /** The complete turn, or `undefined` when no turn has this identity; inconsistent records are faults. */
  find(id: TurnId): Promise<Turn | undefined>;
  /** Every turn still pending, in order of acceptance. */
  findPending(): Promise<readonly Turn[]>;
  saveConclusion(turn: Turn): Promise<Result<void, TurnAlreadyClosed>>;
}
