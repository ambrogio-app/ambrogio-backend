import { describe, expect, it } from 'vitest';
import { createBeginTurn } from './begin-turn.use-case.js';
import { createCompleteTurn } from './complete-turn.use-case.js';
import type { ConversationWrite } from './conversation-write.port.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';

describe('complete turn use case', () => {
  it('uses the supplied clock for completion and does not turn technical faults into refusals', async () => {
    const archive: ConversationWrite = {
      async admit() { throw new Error('unused'); },
      async complete(input) {
        expect(input.finishedAt).toEqual(new Date(5678));
        expect(input.outcome).toEqual({ kind: 'interrupted' });
        return { ok: false, error: { kind: 'turn_not_active' } };
      },
    };
    const complete = createCompleteTurn({ archive, clock: { now: () => new Date(5678) } });
    expect(await complete({ turnId, outcome: { kind: 'interrupted' } })).toEqual({
      ok: false, error: { kind: 'turn_not_active' },
    });
    const faulting: ConversationWrite = { ...archive, complete: async () => { throw new Error('disk failed'); } };
    await expect(createCompleteTurn({ archive: faulting, clock: { now: () => new Date(5678) } })({
      turnId, outcome: { kind: 'interrupted' },
    })).rejects.toThrow('disk failed');
  });

  it('returns successful completion as a value and preserves unexpected port faults by identity', async () => {
    const fault = new TypeError('technical archive failure');
    const archive: ConversationWrite = {
      async admit() { throw fault; },
      async complete() { return { ok: true, value: {
        id: turnId, text: 'ciao', acceptedAt: new Date(1234),
        status: 'answered', answer: 'salve', finishedAt: new Date(5678),
      } }; },
    };
    const clock = { now: () => new Date(5678) };
    const begin = createBeginTurn({ archive, identifiers: { next: () => turnId }, clock });
    await expect(begin({ conversationId, text: 'ciao' })).rejects.toBe(fault);
    const complete = createCompleteTurn({ archive, clock });
    expect(await complete({ turnId, outcome: { kind: 'answer', text: 'salve' } })).toEqual({
      ok: true, value: { turnId, status: 'answered' },
    });
    const faulting: ConversationWrite = { ...archive, complete: async () => { throw fault; } };
    await expect(createCompleteTurn({ archive: faulting, clock })({
      turnId, outcome: { kind: 'interrupted' },
    })).rejects.toBe(fault);
  });
});
