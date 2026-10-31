// Test support: drive the turn repository through the Application, as the server does.
import type { Kysely } from 'kysely';
import { ConversationId, TurnId } from '../../src/domain/identities.js';
import { Turn } from '../../src/domain/turn/turn.js';
import { createCompleteTurn, type CompleteTurnOutcome } from '../../src/application/complete-turn/complete-turn.use-case.js';
import { createInterruptPendingTurns } from '../../src/application/interrupt-pending-turns/interrupt-pending-turns.use-case.js';
import type { TurnRepository } from '../../src/application/turn-repository.port.js';
import type { ConversationDatabase } from '../../src/adapters/out/postgres/conversation-archive.js';
import { PostgresTurnRepository } from '../../src/adapters/out/postgres/postgres-turn-repository.adapter.js';

export type TurnData = Readonly<{ id: string; text: string; acceptedAt: Date }>;

export function newTurn(conversationId: string, turn: TurnData): Turn {
  return Turn.create({ id: TurnId.create(turn.id), conversationId: ConversationId.create(conversationId),
    text: turn.text, acceptedAt: turn.acceptedAt });
}

/** Admits a turn built from plain data, creating its conversation when asked. */
export function admitTurn(turns: TurnRepository, input: Readonly<{
  conversationId: string; createConversation: boolean; turn: TurnData;
}>) {
  return turns.admit({ turn: newTurn(input.conversationId, input.turn),
    conversation: input.createConversation ? 'new' : 'existing' });
}

/** Concludes a stored turn through the complete-turn use case and returns the saved outcome. */
export async function completeTurn(turns: TurnRepository, input: Readonly<{
  turnId: string; outcome: CompleteTurnOutcome; finishedAt: Date;
}>) {
  const result = await createCompleteTurn({ turns, clock: { now: () => input.finishedAt } })(input);
  if (!result.ok) return result;
  const turn = (await turns.find(TurnId.create(input.turnId)))!;
  return { ok: true as const, value: { status: turn.status, answer: turn.answerText, error: turn.errorMessage,
    agent: turn.respondingAgent, finishedAt: turn.finishedAt } };
}

/** Interrupts the pending turns of an archive at a given instant, as startup and shutdown do. */
export function interruptPendingTurns(db: Kysely<ConversationDatabase>, at: Date): Promise<number> {
  return createInterruptPendingTurns({ turns: new PostgresTurnRepository(db), clock: { now: () => at } })();
}
