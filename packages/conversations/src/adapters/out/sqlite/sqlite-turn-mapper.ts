import { ProjectError } from '../../../domain/project-error.js';
import { ConversationId, TurnId } from '../../../domain/identities.js';
import { Turn } from '../../../domain/turn.js';
import type { HistoryTurn } from '../../../application/conversation-history-read.port.js';
import type { Selectable } from 'kysely';
import type { TurnRows } from './schema.js';

export function toMillis(date: Date): number {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new ProjectError('Invalid conversation instant');
  return date.getTime();
}

export function fromMillis(value: unknown): Date {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new ProjectError('Invalid persisted instant');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() !== value) throw new ProjectError('Invalid persisted instant');
  return date;
}

type TurnRow = Selectable<TurnRows>;

/** The stored turn checked against the current contract, before it becomes a Domain value or a projection. */
type CheckedRow = Readonly<{ id: string; conversationId: string; text: string; acceptedAt: Date }> & (
  | Readonly<{ status: 'pending' }>
  | Readonly<{ status: 'answered'; answer: string; finishedAt: Date; agent?: string }>
  | Readonly<{ status: 'failed'; error: string; finishedAt: Date }>
  | Readonly<{ status: 'interrupted'; finishedAt: Date }>);

function checkRow(row: TurnRow): CheckedRow {
  if (typeof row.id !== 'string' || row.id.length === 0 || typeof row.conversation_id !== 'string'
    || typeof row.text !== 'string') throw new ProjectError('Invalid persisted turn state');
  const base = { id: row.id, conversationId: row.conversation_id, text: row.text, acceptedAt: fromMillis(row.accepted_at) };
  if (row.agent !== null && row.status !== 'answered') throw new ProjectError('Invalid persisted turn state');
  switch (row.status) {
    case 'pending':
      if (row.answer !== null || row.error !== null || row.finished_at !== null) break;
      return { ...base, status: 'pending' };
    case 'answered':
      if (row.answer === null || row.error !== null) break;
      return { ...base, status: 'answered', answer: row.answer, finishedAt: fromMillis(row.finished_at),
        ...(row.agent === null ? {} : { agent: row.agent }) };
    case 'failed':
      if (row.error === null || row.answer !== null) break;
      return { ...base, status: 'failed', error: row.error, finishedAt: fromMillis(row.finished_at) };
    case 'interrupted':
      if (row.answer !== null || row.error !== null) break;
      return { ...base, status: 'interrupted', finishedAt: fromMillis(row.finished_at) };
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
    finished_at: toMillis(finishedAt),
  };
}
