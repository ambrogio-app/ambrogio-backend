import { describe, expect, it } from 'vitest';
import { ConversationId, TurnId } from '../domain/identities.js';
import { Turn } from '../domain/turn.js';
import { createInterruptPendingTurns } from './interrupt-pending-turns.use-case.js';
import type { TurnRepository } from './turn-repository.port.js';

const conversations = ['dc89cb5e-e695-43cc-8a04-917316771ea4', 'ab02e7da-7a10-4585-8b09-ab8f6b4b93ee'];
const turnIds = ['79e437a8-c11a-48ba-b476-e4fd4712ea58', '82d590bb-216d-407d-8034-55f1db4a3212'];

describe('interrupt pending turns use case', () => {
  // Verification: Prova delle transizioni del turno attraverso il Root
  it('interrupts each loaded pending turn through the Root, saves it and counts the saved ones', async () => {
    const pending = turnIds.map((id, index) => Turn.create({
      id: TurnId.create(id), conversationId: ConversationId.create(conversations[index]!), text: 'ciao', acceptedAt: new Date(1000),
    }));
    const calls: string[] = [];
    const turns: TurnRepository = {
      async admit() { throw new Error('unused'); },
      async find() { throw new Error('unused'); },
      async findPending() { calls.push('findPending'); return pending; },
      async saveConclusion(turn) {
        calls.push(`save ${turn.id.value} ${turn.status} ${turn.finishedAt?.getTime()}`);
        // The second turn was concluded meanwhile by another writer.
        return turn === pending[1] ? { ok: false, error: { kind: 'turn_already_closed' } } : { ok: true, value: undefined };
      },
    };
    expect(await createInterruptPendingTurns({ turns, clock: { now: () => new Date(3000) } })()).toBe(1);
    expect(calls).toEqual(['findPending', `save ${turnIds[0]} interrupted 3000`, `save ${turnIds[1]} interrupted 3000`]);
  });
});
