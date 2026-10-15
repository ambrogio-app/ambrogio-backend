import { describe, expect, it } from 'vitest';
import { Turn } from '../../src/domain/turn.js';

const id = 'ba57b21b-7d55-4c11-8136-9181bef673d1';

function accepted() {
  return Turn.accept({ id, text: '  ciao  mondo  ', acceptedAt: new Date(1_700_000_000_000) });
}

describe('Turn', () => {
  it('starts pending, preserves identity and original text, and finishes once', () => {
    for (const finish of [
      (turn: Turn) => turn.answer('salve', new Date(1_700_000_000_001)),
      (turn: Turn) => turn.fail('Non posso rispondere', new Date(1_700_000_000_001)),
      (turn: Turn) => turn.interrupt(new Date(1_700_000_000_001)),
    ]) {
      const turn = accepted();
      expect(turn.snapshot()).toMatchObject({ id, text: '  ciao  mondo  ', status: 'pending' });
      expect(finish(turn).ok).toBe(true);
      const final = turn.snapshot();
      expect(final.id).toBe(id);
      expect(final.text).toBe('  ciao  mondo  ');
      expect(final.status).not.toBe('pending');
      expect(turn.answer('late', new Date(1_700_000_000_002))).toEqual({ ok: false, error: { kind: 'already_closed' } });
      expect(turn.fail('late', new Date(1_700_000_000_002))).toEqual({ ok: false, error: { kind: 'already_closed' } });
      expect(turn.interrupt(new Date(1_700_000_000_002))).toEqual({ ok: false, error: { kind: 'already_closed' } });
      expect(turn.snapshot()).toEqual(final);
    }
  });

  it('restores valid states without replay and rejects incompatible persisted data', () => {
    for (const finish of [
      (turn: Turn) => turn.answer('salve', new Date(1_700_000_000_001)),
      (turn: Turn) => turn.fail('Errore pubblico', new Date(1_700_000_000_001)),
      (turn: Turn) => turn.interrupt(new Date(1_700_000_000_001)),
    ]) {
      const turn = accepted();
      finish(turn);
      const restored = Turn.restore(turn.snapshot());
      expect(restored.snapshot()).toEqual(turn.snapshot());
      expect(restored.interrupt(new Date(1_700_000_000_002)).ok).toBe(false);
    }
    const turn = accepted();
    turn.answer('salve', new Date(1_700_000_000_001));
    expect(() => Turn.restore({ ...turn.snapshot(), status: 'pending' } as never)).toThrow();
    expect(() => Turn.restore({ ...turn.snapshot(), status: 'unknown' } as never)).toThrow();
  });

  it('defensively copies valid dates on creation, restore and read', () => {
    const supplied = new Date(1_700_000_000_000);
    const turn = Turn.accept({ id, text: 'ciao', acceptedAt: supplied });
    supplied.setTime(0);
    const snapshot = turn.snapshot();
    snapshot.acceptedAt.setTime(0);
    expect(turn.snapshot().acceptedAt.getTime()).toBe(1_700_000_000_000);

    const finishedAt = new Date(1_700_000_000_001);
    turn.interrupt(finishedAt);
    finishedAt.setTime(0);
    const restored = Turn.restore(turn.snapshot());
    const restoredSnapshot = restored.snapshot();
    if (restoredSnapshot.status === 'pending') throw new Error('expected terminal state');
    restoredSnapshot.finishedAt.setTime(0);
    expect(restored.snapshot()).toEqual(turn.snapshot());
  });

  it('rejects invalid dates and leaves the state unchanged', () => {
    expect(() => Turn.accept({ id, text: 'ciao', acceptedAt: new Date(NaN) })).toThrow();
    const turn = accepted();
    expect(() => turn.answer('salve', new Date(NaN))).toThrow();
    expect(turn.snapshot().status).toBe('pending');
    expect(() => Turn.restore({ ...turn.snapshot(), acceptedAt: new Date(NaN) })).toThrow();
    turn.answer('salve', new Date(1_700_000_000_001));
    expect(() => Turn.restore({ ...turn.snapshot(), finishedAt: new Date(NaN) } as never)).toThrow();
  });
});
