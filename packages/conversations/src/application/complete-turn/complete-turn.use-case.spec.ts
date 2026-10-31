import { describe, expect, it } from 'vitest';
import { ConversationId, TurnId } from '../../domain/identities.js';
import { Turn } from '../../domain/turn/turn.js';
import { createCompleteTurn } from './complete-turn.use-case.js';
import type { TurnRepository } from '../turn-repository.port.js';

const conversationId = ConversationId.create('dc89cb5e-e695-43cc-8a04-917316771ea4');
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
const clock = { now: () => new Date(5678) };

function pendingTurn() {
  return Turn.create({ id: TurnId.create(turnId), conversationId, text: 'ciao', acceptedAt: new Date(1234) });
}

/** A repository double that records what the use case asks of it. */
function recording(stored: Turn | undefined, save: TurnRepository['saveConclusion'] = async () => ({ ok: true, value: undefined })) {
  const calls: string[] = [];
  const saved: Turn[] = [];
  const turns: TurnRepository = {
    async admit() { throw new Error('unused'); },
    async find(id) { calls.push(`find ${id.value}`); return stored; },
    async findPending() { throw new Error('unused'); },
    async saveConclusion(turn) { calls.push(`save ${turn.status}`); saved.push(turn); return save(turn); },
  };
  return { turns, calls, saved };
}

describe('complete turn use case', () => {
  // Verification: Prova delle transizioni del turno attraverso il Root
  it('loads the turn, concludes it through the Root with the supplied clock and saves it', async () => {
    for (const [outcome, status] of [
      [{ kind: 'answer', text: 'salve', agent: 'home' }, 'answered'],
      [{ kind: 'error', message: 'Non disponibile' }, 'failed'],
      [{ kind: 'interrupted' }, 'interrupted'],
    ] as const) {
      const { turns, calls, saved } = recording(pendingTurn());
      expect(await createCompleteTurn({ turns, clock })({ turnId, outcome }))
        .toEqual({ ok: true, value: { turnId, status } });
      expect(calls).toEqual([`find ${turnId}`, `save ${status}`]);
      expect(saved[0]!.finishedAt).toEqual(new Date(5678));
    }
    const { turns, saved } = recording(pendingTurn());
    await createCompleteTurn({ turns, clock })({ turnId, outcome: { kind: 'answer', text: 'salve', agent: 'home' } });
    expect([saved[0]!.answerText, saved[0]!.respondingAgent]).toEqual(['salve', 'home']);
  });

  // Verification: Prova delle transizioni del turno attraverso il Root
  it('returns a refused transition or a refused save as the expected outcome, without saving after a refusal', async () => {
    const closed = pendingTurn();
    closed.interrupt(new Date(2000));
    const refused = recording(closed);
    expect(await createCompleteTurn({ turns: refused.turns, clock })({ turnId, outcome: { kind: 'answer', text: 'late' } }))
      .toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    expect(refused.calls).toEqual([`find ${turnId}`]);
    expect(closed.status).toBe('interrupted');

    const conflict = recording(pendingTurn(), async () => ({ ok: false, error: { kind: 'turn_already_closed' } }));
    expect(await createCompleteTurn({ turns: conflict.turns, clock })({ turnId, outcome: { kind: 'interrupted' } }))
      .toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
    expect(conflict.calls).toEqual([`find ${turnId}`, 'save interrupted']);
  });

  it('treats a missing turn and port faults as unexpected failures, preserving them by identity', async () => {
    await expect(createCompleteTurn({ turns: recording(undefined).turns, clock })({
      turnId, outcome: { kind: 'interrupted' },
    })).rejects.toThrow('Admitted turn missing from the archive');
    const fault = new TypeError('technical archive failure');
    const faulting = recording(pendingTurn(), async () => { throw fault; });
    await expect(createCompleteTurn({ turns: faulting.turns, clock })({
      turnId, outcome: { kind: 'interrupted' },
    })).rejects.toBe(fault);
  });
});
