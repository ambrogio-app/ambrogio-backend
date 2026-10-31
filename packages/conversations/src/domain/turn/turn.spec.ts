import { describe, expect, it } from 'vitest';
import { ConversationId, TurnId } from '../identities.js';
import { Turn, type SavedTurn } from './turn.js';

const id = TurnId.create('ba57b21b-7d55-4c11-8136-9181bef673d1');
const conversationId = ConversationId.create('dc89cb5e-e695-43cc-8a04-917316771ea4');

function accepted() {
  return Turn.create({ id, conversationId, text: '  ciao  mondo  ', acceptedAt: new Date(1_700_000_000_000) });
}

/** The saved state of a turn, read through its targeted getters as persistence does. */
function saved(turn: Turn): SavedTurn {
  const base = { id: turn.id, conversationId: turn.conversationId, text: turn.text, acceptedAt: turn.acceptedAt };
  switch (turn.status) {
    case 'pending': return { ...base, status: 'pending' };
    case 'answered': return { ...base, status: 'answered', answer: turn.answerText!, finishedAt: turn.finishedAt!,
      ...(turn.respondingAgent === undefined ? {} : { agent: turn.respondingAgent }),
      ...(turn.actions === undefined ? {} : { actions: turn.actions }) };
    case 'failed': return { ...base, status: 'failed', error: turn.errorMessage!, finishedAt: turn.finishedAt! };
    case 'interrupted': return { ...base, status: 'interrupted', finishedAt: turn.finishedAt! };
  }
}

describe('Turn', () => {
  // Verification: Prova degli stati validi del turno
  it('starts pending, preserves identity and original text, and finishes once', () => {
    for (const finish of [
      (turn: Turn) => turn.answer('salve', new Date(1_700_000_000_001)),
      (turn: Turn) => turn.fail('Non posso rispondere', new Date(1_700_000_000_001)),
      (turn: Turn) => turn.interrupt(new Date(1_700_000_000_001)),
    ]) {
      const turn = accepted();
      expect(saved(turn)).toMatchObject({ id, conversationId, text: '  ciao  mondo  ', status: 'pending' });
      expect(finish(turn).ok).toBe(true);
      const final = saved(turn);
      expect(final.id.equals(id)).toBe(true);
      expect(final.conversationId.equals(conversationId)).toBe(true);
      expect(final.text).toBe('  ciao  mondo  ');
      expect(final.status).not.toBe('pending');
      expect(turn.answer('late', new Date(1_700_000_000_002))).toEqual({ ok: false, error: { kind: 'already_closed' } });
      expect(turn.fail('late', new Date(1_700_000_000_002))).toEqual({ ok: false, error: { kind: 'already_closed' } });
      expect(turn.interrupt(new Date(1_700_000_000_002))).toEqual({ ok: false, error: { kind: 'already_closed' } });
      expect(saved(turn)).toEqual(final);
    }
  });

  it('rehydrates valid states without replay and rejects incompatible persisted data', () => {
    for (const finish of [
      (turn: Turn) => turn.answer('salve', new Date(1_700_000_000_001)),
      (turn: Turn) => turn.fail('Errore pubblico', new Date(1_700_000_000_001)),
      (turn: Turn) => turn.interrupt(new Date(1_700_000_000_001)),
    ]) {
      const turn = accepted();
      finish(turn);
      const restored = Turn.rehydrate(saved(turn));
      expect(saved(restored)).toEqual(saved(turn));
      expect(restored.interrupt(new Date(1_700_000_000_002)).ok).toBe(false);
    }
    const pending = Turn.rehydrate(saved(accepted()));
    expect(pending.status).toBe('pending');
    expect(pending.acceptedAt.getTime()).toBe(1_700_000_000_000);
    const turn = accepted();
    turn.answer('salve', new Date(1_700_000_000_001));
    expect(() => Turn.rehydrate({ ...saved(turn), status: 'pending' } as never)).toThrow();
    expect(() => Turn.rehydrate({ ...saved(turn), status: 'unknown' } as never)).toThrow();
    expect(() => Turn.rehydrate({ ...saved(turn), id: id.value } as never)).toThrow('Invalid turn identity');
    expect(() => Turn.rehydrate({ ...saved(turn), conversationId: id } as never)).toThrow('Invalid conversation identity');
    expect(() => Turn.create({ id, conversationId, text: '   ', acceptedAt: new Date(0) })).toThrow('Invalid turn text');
  });

  // Verification: Prova della continuità dell'agente nella conversazione
  it('keeps the responding agent only on answered turns', () => {
    const turn = accepted();
    expect(turn.answer('salve', new Date(1_700_000_000_001), 'home').ok).toBe(true);
    expect(saved(turn)).toMatchObject({ status: 'answered', answer: 'salve', agent: 'home' });
    expect(saved(Turn.rehydrate(saved(turn)))).toEqual(saved(turn));
    const unknown = accepted();
    unknown.answer('salve', new Date(1_700_000_000_001));
    expect(unknown.respondingAgent).toBeUndefined();
    expect(() => accepted().answer('salve', new Date(1_700_000_000_001), '')).toThrow();
    const failed = accepted();
    failed.fail('Errore pubblico', new Date(1_700_000_000_001));
    expect(() => Turn.rehydrate({ ...saved(failed), agent: 'home' } as never)).toThrow();
    expect(() => Turn.rehydrate({ ...saved(turn), agent: '' } as never)).toThrow();
  });

  // Verification: Prova delle azioni nello storico
  it('keeps checked private copies of the actions only on answered turns', () => {
    const input = { name: 'luce' };
    const actions = [{ tool: 'HassTurnOn', input, output: { ok: true } }, { tool: 'HassTurnOff', input: {}, error: 'No' }];
    const turn = accepted();
    expect(turn.answer('Ho acceso la luce.', new Date(1_700_000_000_001), 'home', actions).ok).toBe(true);
    input.name = 'changed';
    expect(turn.actions).toEqual([{ tool: 'HassTurnOn', input: { name: 'luce' }, output: { ok: true } },
      { tool: 'HassTurnOff', input: {}, error: 'No' }]);
    (turn.actions as unknown as Array<{ tool: string }>)[0]!.tool = 'changed';
    expect(turn.actions?.[0]?.tool).toBe('HassTurnOn');
    expect(saved(Turn.rehydrate(saved(turn)))).toEqual(saved(turn));
    for (const invalid of [[], [{ tool: '', input: {}, output: 1 }], [{ tool: 't', input: [], output: 1 }],
      [{ tool: 't', input: {}, output: 1, error: 'e' }], [{ tool: 't', input: {} }], [{ tool: 't', input: {}, error: '' }],
      [{ tool: 't', input: {}, output: Number.NaN }], [{ tool: 't', input: {}, output: 1, extra: true }]]) {
      expect(() => accepted().answer('x', new Date(1_700_000_000_001), 'home', invalid as never), JSON.stringify(invalid))
        .toThrow('Invalid turn action');
    }
    const failed = accepted();
    failed.fail('Errore pubblico', new Date(1_700_000_000_001));
    expect(() => Turn.rehydrate({ ...saved(failed), actions: actions } as never)).toThrow();
  });

  // Verification: Prova della validità e delle copie degli istanti
  // Verification: Prova dell'isolamento dello stato del turno
  it('defensively copies valid dates on creation, rehydration and read', () => {
    const supplied = new Date(1_700_000_000_000);
    const turn = Turn.create({ id, conversationId, text: 'ciao', acceptedAt: supplied });
    supplied.setTime(0);
    turn.acceptedAt.setTime(0);
    expect(turn.acceptedAt.getTime()).toBe(1_700_000_000_000);

    const finishedAt = new Date(1_700_000_000_001);
    turn.interrupt(finishedAt);
    finishedAt.setTime(0);
    turn.finishedAt!.setTime(0);
    expect(turn.finishedAt!.getTime()).toBe(1_700_000_000_001);

    const state = saved(turn);
    const restored = Turn.rehydrate(state);
    state.acceptedAt.setTime(0);
    if (state.status !== 'interrupted') throw new Error('expected an interrupted turn');
    state.finishedAt.setTime(0);
    expect(restored.acceptedAt.getTime()).toBe(1_700_000_000_000);
    expect(restored.finishedAt!.getTime()).toBe(1_700_000_000_001);
  });

  // Verification: Prova dell'isolamento dello stato del turno
  it('exposes targeted getters and Domain operations only, without access to its whole state', () => {
    const turn = accepted();
    expect(Object.keys(turn)).toEqual([]);
    expect(Object.getOwnPropertyNames(Turn.prototype).sort()).toEqual([
      'acceptedAt', 'actions', 'answer', 'answerText', 'constructor', 'conversationId', 'errorMessage', 'fail', 'finishedAt',
      'id', 'interrupt', 'respondingAgent', 'status', 'text',
    ]);
    expect(Object.getOwnPropertyNames(Turn).filter(name => !['length', 'name', 'prototype'].includes(name)).sort())
      .toEqual(['create', 'rehydrate']);
    for (const name of ['id', 'conversationId', 'text', 'acceptedAt', 'status', 'answerText', 'errorMessage',
      'respondingAgent', 'finishedAt']) {
      const descriptor = Object.getOwnPropertyDescriptor(Turn.prototype, name)!;
      expect(descriptor.get, name).toBeTypeOf('function');
      expect(descriptor.set, name).toBeUndefined();
    }
  });

  it('rejects invalid dates and leaves the state unchanged', () => {
    expect(() => Turn.create({ id, conversationId, text: 'ciao', acceptedAt: new Date(NaN) })).toThrow();
    const turn = accepted();
    expect(() => turn.answer('salve', new Date(NaN))).toThrow();
    expect(turn.status).toBe('pending');
    expect(turn.finishedAt).toBeUndefined();
    expect(() => Turn.rehydrate({ ...saved(turn), acceptedAt: new Date(NaN) })).toThrow();
    turn.answer('salve', new Date(1_700_000_000_001));
    expect(() => Turn.rehydrate({ ...saved(turn), finishedAt: new Date(NaN) } as never)).toThrow();
  });
});
