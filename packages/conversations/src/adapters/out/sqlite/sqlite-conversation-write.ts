import { sql, type Kysely } from 'kysely';
import type { Result, TurnSnapshot } from '../../../domain/turn.js';
import { Turn } from '../../../domain/turn.js';
import type {
  AdmitTurn, AdmissionRejection, CompleteTurn, ConversationWrite, TurnNotActive,
} from '../../../application/conversation-write.js';
import type { ConversationDatabase, TurnRows } from './schema.js';

function toMillis(date: Date): number {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Invalid conversation instant');
  return date.getTime();
}

function fromMillis(value: unknown): Date {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error('Invalid persisted instant');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() !== value) throw new Error('Invalid persisted instant');
  return date;
}

function restoreTurn(row: TurnRows): Turn {
  const base = { id: row.id, text: row.text, acceptedAt: fromMillis(row.accepted_at) };
  switch (row.status) {
    case 'pending':
      if (row.answer !== null || row.error !== null || row.finished_at !== null) break;
      return Turn.restore({ ...base, status: 'pending' });
    case 'answered':
      if (row.answer === null || row.error !== null) break;
      return Turn.restore({ ...base, status: 'answered', answer: row.answer, finishedAt: fromMillis(row.finished_at) });
    case 'failed':
      if (row.error === null || row.answer !== null) break;
      return Turn.restore({ ...base, status: 'failed', error: row.error, finishedAt: fromMillis(row.finished_at) });
    case 'interrupted':
      if (row.answer !== null || row.error !== null) break;
      return Turn.restore({ ...base, status: 'interrupted', finishedAt: fromMillis(row.finished_at) });
  }
  throw new Error('Invalid persisted turn state');
}

function isSqliteBusy(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_BUSY';
}

class AdmissionLockBusy extends Error {
  constructor(cause: unknown) {
    super('Admission could not acquire the archive lock', { cause });
  }
}

export class SqliteConversationWrite implements ConversationWrite {
  private writeInProgress = false;

  constructor(private readonly db: Kysely<ConversationDatabase>) {}

  private async transaction<T>(
    run: (connection: Kysely<ConversationDatabase>) => Promise<T>,
    classifyAdmissionLock = false,
  ): Promise<T> {
    if (this.writeInProgress) throw new Error('Concurrent archive write');
    this.writeInProgress = true;
    try {
      return await this.db.connection().execute(async connection => {
        try {
          // A synchronous SQLite busy wait would block the event loop that must finish the other write.
          await sql.raw('pragma busy_timeout = 0').execute(connection);
          await sql.raw('begin immediate').execute(connection);
        } catch (error) {
          if (classifyAdmissionLock && isSqliteBusy(error)) throw new AdmissionLockBusy(error);
          throw error;
        }
        try {
          const result = await run(connection);
          await sql.raw('commit').execute(connection);
          return result;
        } catch (error) {
          try { await sql.raw('rollback').execute(connection); } catch { /* preserve the original failure */ }
          throw error;
        }
      });
    } finally {
      this.writeInProgress = false;
    }
  }

  async admit(input: AdmitTurn): Promise<Result<void, AdmissionRejection>> {
    if (this.writeInProgress) return { ok: false, error: { kind: 'archive_busy' } };
    const state = input.turn.snapshot();
    if (state.status !== 'pending') throw new Error('Only pending turns can be admitted');
    try {
      return await this.transaction(async db => {
        if (!input.createConversation) {
          const conversation = await db.selectFrom('conversations').select('id')
            .where('id', '=', input.conversationId).executeTakeFirst();
          if (!conversation) return { ok: false, error: { kind: 'conversation_missing' } };
        }
        const installation = await db.selectFrom('installation').select('active_turn_id')
          .where('id', '=', 1).executeTakeFirst();
        if (!installation) throw new Error('Installation occupancy record missing');
        if (installation.active_turn_id !== null) {
          return { ok: false, error: { kind: 'conversation_occupied' } };
        }
        const acceptedAt = toMillis(state.acceptedAt);
        if (input.createConversation) {
          await db.insertInto('conversations').values({
            id: input.conversationId, created_at: acceptedAt, last_activity_at: acceptedAt,
          }).execute();
        } else {
          const updated = await db.updateTable('conversations').set({ last_activity_at: acceptedAt })
            .where('id', '=', input.conversationId).executeTakeFirst();
          if (updated.numUpdatedRows !== 1n) throw new Error('Conversation activity update failed');
        }
        await db.insertInto('turns').values({
          id: state.id, conversation_id: input.conversationId, text: state.text,
          accepted_at: acceptedAt, status: 'pending', answer: null, error: null, finished_at: null,
        }).execute();
        const occupied = await db.updateTable('installation').set({ active_turn_id: state.id })
          .where('id', '=', 1).where('active_turn_id', 'is', null).executeTakeFirst();
        if (occupied.numUpdatedRows !== 1n) throw new Error('Installation admission postcondition failed');
        return { ok: true, value: undefined };
      }, true);
    } catch (error) {
      if (error instanceof AdmissionLockBusy) return { ok: false, error: { kind: 'archive_busy' } };
      throw error;
    }
  }

  async complete(input: CompleteTurn): Promise<Result<TurnSnapshot, TurnNotActive>> {
    return this.transaction(async db => {
      const installation = await db.selectFrom('installation').select('active_turn_id')
        .where('id', '=', 1).executeTakeFirst();
      if (!installation) throw new Error('Installation occupancy record missing');
      if (installation.active_turn_id !== input.turnId) {
        return { ok: false, error: { kind: 'turn_not_active' } };
      }
      const row = await db.selectFrom('turns').selectAll().where('id', '=', input.turnId).executeTakeFirst();
      if (!row) throw new Error('Active turn record missing');
      const turn = restoreTurn(row);
      let result: Result<void, { kind: 'already_closed' }>;
      switch (input.outcome.kind) {
        case 'answer': result = turn.answer(input.outcome.text, input.finishedAt); break;
        case 'error': result = turn.fail(input.outcome.message, input.finishedAt); break;
        case 'interrupted': result = turn.interrupt(input.finishedAt); break;
        default: return assertNever(input.outcome);
      }
      if (!result.ok) throw new Error('Active turn is already closed');
      const state = turn.snapshot();
      if (state.status === 'pending') throw new Error('Turn completion did not finish');
      const updated = await db.updateTable('turns').set({
        status: state.status,
        answer: state.status === 'answered' ? state.answer : null,
        error: state.status === 'failed' ? state.error : null,
        finished_at: toMillis(state.finishedAt),
      }).where('id', '=', input.turnId).where('status', '=', 'pending').executeTakeFirst();
      if (updated.numUpdatedRows !== 1n) throw new Error('Turn completion postcondition failed');
      const released = await db.updateTable('installation').set({ active_turn_id: null })
        .where('id', '=', 1).where('active_turn_id', '=', input.turnId).executeTakeFirst();
      if (released.numUpdatedRows !== 1n) throw new Error('Installation release postcondition failed');
      return { ok: true, value: state };
    });
  }
}

function assertNever(value: never): never {
  throw new Error('Unhandled turn outcome');
}
