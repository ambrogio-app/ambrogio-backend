import { ProjectError } from '../../../project-error.js';
import { sql, type Kysely } from 'kysely';
import type { Result, TurnSnapshot } from '../../../domain/turn.js';
import type {
  AdmitTurn, AdmissionRejection, CompleteTurn, ConversationWrite, TurnNotActive,
} from '../../../application/conversation-write.js';
import type { ConversationDatabase } from './schema.js';
import { restoreTurn, toMillis } from './sqlite-turn-mapper.js';
import { AdmissionLockBusy, withImmediateTransaction } from './sqlite-transaction.js';

export class SqliteConversationWrite implements ConversationWrite {
  private writeInProgress = false;

  constructor(private readonly db: Kysely<ConversationDatabase>) {}

  private async transaction<T>(
    run: (connection: Kysely<ConversationDatabase>) => Promise<T>,
    classifyAdmissionLock = false,
  ): Promise<T> {
    if (this.writeInProgress) throw new ProjectError('Concurrent archive write');
    this.writeInProgress = true;
    try {
      return await withImmediateTransaction(this.db, run, classifyAdmissionLock);
    } finally {
      this.writeInProgress = false;
    }
  }

  async admit(input: AdmitTurn): Promise<Result<void, AdmissionRejection>> {
    if (this.writeInProgress) return { ok: false, error: { kind: 'archive_busy' } };
    const state = input.turn.snapshot();
    if (state.status !== 'pending') throw new ProjectError('Only pending turns can be admitted');
    try {
      return await this.transaction(async db => {
        if (!input.createConversation) {
          const conversation = await db.selectFrom('conversations').select('id')
            .where('id', '=', input.conversationId).executeTakeFirst();
          if (!conversation) return { ok: false, error: { kind: 'conversation_missing' } };
        }
        const installation = await db.selectFrom('installation').select('active_turn_id')
          .where('id', '=', 1).executeTakeFirst();
        if (!installation) throw new ProjectError('Installation occupancy record missing');
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
          if (updated.numUpdatedRows !== 1n) throw new ProjectError('Conversation activity update failed');
        }
        const ordinalResult = await db.selectFrom('turns')
          .select(sql<number>`coalesce(max(ordinal), 0)`.as('last'))
          .where('conversation_id', '=', input.conversationId).executeTakeFirstOrThrow();
        await db.insertInto('turns').values({
          id: state.id, conversation_id: input.conversationId, text: state.text,
          ordinal: ordinalResult.last + 1,
          accepted_at: acceptedAt, status: 'pending', answer: null, error: null, finished_at: null,
        }).execute();
        const occupied = await db.updateTable('installation').set({ active_turn_id: state.id })
          .where('id', '=', 1).where('active_turn_id', 'is', null).executeTakeFirst();
        if (occupied.numUpdatedRows !== 1n) throw new ProjectError('Installation admission postcondition failed');
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
      if (!installation) throw new ProjectError('Installation occupancy record missing');
      if (installation.active_turn_id !== input.turnId) {
        return { ok: false, error: { kind: 'turn_not_active' } };
      }
      const row = await db.selectFrom('turns').selectAll().where('id', '=', input.turnId).executeTakeFirst();
      if (!row) throw new ProjectError('Active turn record missing');
      const turn = restoreTurn(row);
      let result: Result<void, { kind: 'already_closed' }>;
      switch (input.outcome.kind) {
        case 'answer': result = turn.answer(input.outcome.text, input.finishedAt); break;
        case 'error': result = turn.fail(input.outcome.message, input.finishedAt); break;
        case 'interrupted': result = turn.interrupt(input.finishedAt); break;
        default: return assertNever(input.outcome);
      }
      if (!result.ok) throw new ProjectError('Active turn is already closed');
      const state = turn.snapshot();
      if (state.status === 'pending') throw new ProjectError('Turn completion did not finish');
      const updated = await db.updateTable('turns').set({
        status: state.status,
        answer: state.status === 'answered' ? state.answer : null,
        error: state.status === 'failed' ? state.error : null,
        finished_at: toMillis(state.finishedAt),
      }).where('id', '=', input.turnId).where('status', '=', 'pending').executeTakeFirst();
      if (updated.numUpdatedRows !== 1n) throw new ProjectError('Turn completion postcondition failed');
      const released = await db.updateTable('installation').set({ active_turn_id: null })
        .where('id', '=', 1).where('active_turn_id', '=', input.turnId).executeTakeFirst();
      if (released.numUpdatedRows !== 1n) throw new ProjectError('Installation release postcondition failed');
      return { ok: true, value: state };
    });
  }
}

function assertNever(value: never): never {
  throw new ProjectError('Unhandled turn outcome');
}
