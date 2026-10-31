import { ProjectError } from '../../../domain/project-error.js';
import { ConversationId, TurnId } from '../../../domain/identities.js';
import { checkTurnActions, Turn, type TurnAction } from '../../../domain/turn/turn.js';
import type { HistoryTurn } from '../../../application/conversation-history-read.port.js';
import { sql, type RawBuilder, type Selectable } from 'kysely';
import type { Json, Turns } from './database.generated.js';

/** The instant written to a `timestamptz(3)` column: a copy of a valid `Date`. */
export function toInstant(date: Date): Date {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new ProjectError('Invalid conversation instant');
  return new Date(date.getTime());
}

/** The instant read from a `timestamptz(3)` column; `infinity` and other values are invalid data. */
export function fromInstant(value: unknown): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new ProjectError('Invalid persisted instant');
  return new Date(value.getTime());
}

type TurnRow = Selectable<Turns>;

/** The stored turn checked against the current contract, before it becomes a Domain value or a projection. */
type CheckedRow = Readonly<{ id: string; conversationId: string; text: string; acceptedAt: Date }> & (
  | Readonly<{ status: 'pending' }>
  | Readonly<{ status: 'answered'; answer: string; finishedAt: Date; agent?: string;
    actions?: readonly TurnAction[] }>
  | Readonly<{ status: 'failed'; error: string; finishedAt: Date }>
  | Readonly<{ status: 'interrupted'; finishedAt: Date }>);

/**
 * The stored actions, untrusted data checked with the Domain rules and rebuilt as a new structure;
 * a JSON value that is not a non-empty array of valid actions is invalid persisted data.
 */
function readActions(value: unknown): readonly TurnAction[] | undefined {
  if (value === null) return undefined;
  if (!Array.isArray(value) || value.length === 0) throw new ProjectError('Invalid persisted turn state');
  try { return checkTurnActions(structuredClone(value)); } catch { throw new ProjectError('Invalid persisted turn state'); }
}

function checkRow(row: TurnRow): CheckedRow {
  if (typeof row.id !== 'string' || row.id.length === 0 || typeof row.conversation_id !== 'string'
    || typeof row.text !== 'string') throw new ProjectError('Invalid persisted turn state');
  const base = { id: row.id, conversationId: row.conversation_id, text: row.text, acceptedAt: fromInstant(row.accepted_at) };
  if ((row.agent !== null || row.actions !== null) && row.status !== 'answered') {
    throw new ProjectError('Invalid persisted turn state');
  }
  switch (row.status) {
    case 'pending':
      if (row.answer !== null || row.error !== null || row.finished_at !== null) break;
      return { ...base, status: 'pending' };
    case 'answered':
      if (row.answer === null || row.error !== null) break;
    {
      const actions = readActions(row.actions);
      return { ...base, status: 'answered', answer: row.answer, finishedAt: fromInstant(row.finished_at),
        ...(row.agent === null ? {} : { agent: row.agent }), ...(actions === undefined ? {} : { actions }) };
    }
    case 'failed':
      if (row.error === null || row.answer !== null) break;
      return { ...base, status: 'failed', error: row.error, finishedAt: fromInstant(row.finished_at) };
    case 'interrupted':
      if (row.answer !== null || row.error !== null) break;
      return { ...base, status: 'interrupted', finishedAt: fromInstant(row.finished_at) };
  }
  throw new ProjectError('Invalid persisted turn state');
}

/** Rebuilds the Domain turn from a stored row; incompatible data is a fault, never repaired. */
export function rehydrateTurn(row: TurnRow): Turn {
  const { id, conversationId, ...state } = checkRow(row);
  return Turn.rehydrate({ ...state, id: TurnId.create(id), conversationId: ConversationId.create(conversationId) });
}

/** Builds the history projection of a stored row, without the Domain. */
export function toHistoryTurn(row: TurnRow): HistoryTurn {
  const { conversationId: _conversation, ...turn } = checkRow(row);
  return turn;
}

/** An array root is bound as one explicit JSON parameter, never left to the driver's array conversion. */
function jsonDocument(value: readonly TurnAction[]): RawBuilder<Json> {
  return sql`${JSON.stringify(value)}::jsonb`;
}

/** The columns of a concluded turn, read from the getters of the Root. */
export function conclusionColumns(turn: Turn) {
  const status = turn.status;
  const finishedAt = turn.finishedAt;
  if (status === 'pending' || finishedAt === undefined) throw new ProjectError('Only concluded turns can be saved');
  return {
    status,
    answer: status === 'answered' ? turn.answerText ?? null : null,
    error: status === 'failed' ? turn.errorMessage ?? null : null,
    agent: status === 'answered' ? turn.respondingAgent ?? null : null,
    actions: status === 'answered' && turn.actions !== undefined ? jsonDocument(turn.actions) : null,
    finished_at: toInstant(finishedAt),
  };
}
