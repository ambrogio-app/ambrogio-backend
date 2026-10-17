import { ProjectError } from '../../../project-error.js';
import { Turn } from '../../../domain/turn.js';
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

export function restoreTurn(row: Selectable<TurnRows>): Turn {
  const base = { id: row.id, text: row.text, acceptedAt: fromMillis(row.accepted_at) };
  if (row.agent !== null && row.status !== 'answered') throw new ProjectError('Invalid persisted turn state');
  switch (row.status) {
    case 'pending':
      if (row.answer !== null || row.error !== null || row.finished_at !== null) break;
      return Turn.restore({ ...base, status: 'pending' });
    case 'answered':
      if (row.answer === null || row.error !== null) break;
      return Turn.restore({ ...base, status: 'answered', answer: row.answer, finishedAt: fromMillis(row.finished_at),
        ...(row.agent === null ? {} : { agent: row.agent }) });
    case 'failed':
      if (row.error === null || row.answer !== null) break;
      return Turn.restore({ ...base, status: 'failed', error: row.error, finishedAt: fromMillis(row.finished_at) });
    case 'interrupted':
      if (row.answer !== null || row.error !== null) break;
      return Turn.restore({ ...base, status: 'interrupted', finishedAt: fromMillis(row.finished_at) });
  }
  throw new ProjectError('Invalid persisted turn state');
}
