import { describe, expect, it } from 'vitest';
import { Turn } from '../../src/domain/turn.js';
import { createExchangeTurn } from '../../src/application/exchange-turn.use-case.js';
import type { BeginTurn } from '../../src/application/begin-turn.use-case.js';
import type { CompleteTurnUseCase } from '../../src/application/complete-turn.use-case.js';
import type { ConversationHistoryRead } from '../../src/application/conversation-history-read.js';
import type { ProduceConversationReply } from '../../src/application/produce-conversation-reply.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
const pending = Turn.accept({ id: turnId, text: '  domanda  ', acceptedAt: new Date(1234) }).snapshot();
const englishFailure = "I can't complete the response.";
const italianFailure = 'Non riesco a completare la risposta.';

function setup() {
  const calls: string[] = [];
  const begin: BeginTurn = async input => {
    calls.push('admit');
    expect(input.text).toBe('  domanda  ');
    return { ok: true, value: { conversationId, turnId, acceptedAt: new Date(1234) } };
  };
  const history: ConversationHistoryRead = {
    async find(id) {
      calls.push('history');
      expect(id).toBe(conversationId);
      return { id, createdAt: new Date(1234), lastActivityAt: new Date(1234), turns: [pending] };
    },
  };
  const outcomes: unknown[] = [];
  const complete: CompleteTurnUseCase = async input => {
    calls.push('complete');
    outcomes.push(input.outcome);
    return { ok: true, value: { turnId, status: input.outcome.kind === 'answer' ? 'answered' : 'failed' } };
  };
  return { calls, begin, history, complete, outcomes, failureMessage: englishFailure };
}

describe('conversation exchange use case', () => {
  it('delivers admission and increments one at a time in production order', async () => {
    const deps = setup();
    const admissionStarted = deferred();
    const releaseAdmission = deferred();
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const observed: string[] = [];
    const exchange = createExchangeTurn({
      ...deps,
      reply: { async *produce() { yield 'prima'; yield 'seconda'; } },
    });

    const result = exchange({ text: '  domanda  ' }, {
      async admitted() {
        observed.push('ammissione iniziata');
        admissionStarted.resolve();
        await releaseAdmission.promise;
        observed.push('ammissione conclusa');
      },
      async delta(text) {
        observed.push(`${text} iniziata`);
        if (text === 'prima') {
          firstStarted.resolve();
          await releaseFirst.promise;
        }
        observed.push(`${text} conclusa`);
      },
    });

    await admissionStarted.promise;
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(observed).toEqual(['ammissione iniziata']);
    releaseAdmission.resolve();
    await firstStarted.promise;
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(observed).toEqual(['ammissione iniziata', 'ammissione conclusa', 'prima iniziata']);
    releaseFirst.resolve();
    expect(await result).toMatchObject({ ok: true, value: { outcome: 'answered' } });
    expect(observed).toEqual([
      'ammissione iniziata', 'ammissione conclusa', 'prima iniziata', 'prima conclusa',
      'seconda iniziata', 'seconda conclusa',
    ]);
  });

  it('admits before producing increments and persists the complete answer', async () => {
    const deps = setup();
    const reply: ProduceConversationReply = {
      async *produce(history) {
        deps.calls.push('produce');
        expect(history.turns.at(-1)).toEqual(pending);
        yield 'Buon';
        yield 'giorno';
      },
    };
    const progress: string[] = [];
    const exchange = createExchangeTurn({ ...deps, reply });
    expect(await exchange({ text: '  domanda  ' }, {
      admitted(id, turn) { progress.push(`admitted:${id}:${turn}`); },
      delta(text) { progress.push(text); },
    })).toEqual({ ok: true, value: { conversationId, turnId, outcome: 'answered' } });
    expect(deps.calls).toEqual(['admit', 'history', 'produce', 'complete']);
    expect(progress).toEqual([`admitted:${conversationId}:${turnId}`, 'Buon', 'giorno']);
    expect(deps.outcomes).toEqual([{ kind: 'answer', text: 'Buongiorno' }]);
  });

  it('continues after the observer disconnects and records a safe error after a partial reply', async () => {
    const deps = setup();
    const reply: ProduceConversationReply = {
      async *produce() {
        yield 'parziale';
        throw new Error('private agent detail');
      },
    };
    const exchange = createExchangeTurn({ ...deps, reply });
    expect(await exchange({ text: '  domanda  ' }, {
      async admitted() { throw new Error('client disconnected'); },
      async delta() { throw new Error('client disconnected'); },
    })).toEqual({ ok: true, value: {
      conversationId, turnId, outcome: 'failed', error: englishFailure,
    } });
    expect(deps.outcomes).toEqual([{ kind: 'error', message: englishFailure }]);
  });

  it.each(['admitted', 'delta'] as const)('keeps the complete answer after a technical %s notification failure', async failureAt => {
    const deps = setup();
    const delivered: string[] = [];
    const exchange = createExchangeTurn({
      ...deps,
      reply: { async *produce() { yield 'prima'; yield 'seconda'; } },
    });
    const result = await exchange({ text: '  domanda  ' }, {
      admitted() {
        if (failureAt === 'admitted') throw new Error('technical delivery failure');
      },
      delta(text) {
        delivered.push(text);
        if (failureAt === 'delta' && text === 'prima') throw new Error('technical delivery failure');
      },
    });

    expect(result).toEqual({ ok: true, value: { conversationId, turnId, outcome: 'answered' } });
    expect(deps.outcomes).toEqual([{ kind: 'answer', text: 'primaseconda' }]);
    expect(delivered).toEqual(['prima', 'seconda']);
  });

  it('requests error completion when history cannot be read', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({
      ...deps,
      history: { async find() { throw new Error('private archive detail'); } },
      reply: { async *produce() { throw new Error('must not run'); } },
    });
    expect(await exchange({ text: '  domanda  ' })).toEqual({ ok: true, value: {
      conversationId, turnId, outcome: 'failed', error: englishFailure,
    } });
    expect(deps.outcomes).toEqual([{ kind: 'error', message: englishFailure }]);
    expect(deps.calls).toEqual(['admit', 'complete']);
  });

  it('persists and returns the same Italian message supplied by configuration', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({
      ...deps,
      failureMessage: italianFailure,
      history: { async find() { throw new Error('private archive detail'); } },
      reply: { async *produce() { throw new Error('must not run'); } },
    });
    expect(await exchange({ text: '  domanda  ' })).toEqual({ ok: true, value: {
      conversationId, turnId, outcome: 'failed', error: italianFailure,
    } });
    expect(deps.outcomes).toEqual([{ kind: 'error', message: italianFailure }]);
  });

  it('treats a missing admitted turn in history as an error', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({
      ...deps,
      history: { async find() { return undefined; } },
      reply: { async *produce() { throw new Error('must not run'); } },
    });
    expect(await exchange({ text: '  domanda  ' })).toMatchObject({ ok: true, value: { outcome: 'failed' } });
    expect(deps.outcomes).toEqual([{ kind: 'error', message: englishFailure }]);
  });

  it('propagates a failure to persist the error after history reading fails', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({
      ...deps,
      history: { async find() { throw new Error('archive read failed'); } },
      complete: async () => { throw new Error('archive write failed'); },
      reply: { async *produce() { throw new Error('must not run'); } },
    });
    await expect(exchange({ text: '  domanda  ' })).rejects.toThrow('archive write failed');
  });

  it('does not report a closed turn when error completion is rejected', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({
      ...deps,
      history: { async find() { throw new Error('archive read failed'); } },
      complete: async () => ({ ok: false, error: { kind: 'turn_not_active' } }),
      reply: { async *produce() { throw new Error('must not run'); } },
    });
    await expect(exchange({ text: '  domanda  ' })).rejects.toThrow('Admitted turn could not be completed');
  });

  it('stops on an admission rejection without reading history or invoking the producer', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({
      ...deps,
      begin: async () => ({ ok: false, error: { kind: 'occupied' } }),
      reply: { async *produce() { throw new Error('must not run'); } },
    });
    expect(await exchange({ text: '  domanda  ' })).toEqual({ ok: false, error: { kind: 'occupied' } });
    expect(deps.calls).toEqual([]);
  });

  it('does not report success when persistence of the answer fails', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({
      ...deps,
      complete: async () => { throw new Error('disk failed'); },
      reply: { async *produce() { yield 'risposta'; } },
    });
    await expect(exchange({ text: '  domanda  ' })).rejects.toThrow('disk failed');
  });
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
