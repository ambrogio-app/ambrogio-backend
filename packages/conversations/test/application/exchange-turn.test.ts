import { describe, expect, it, vi } from 'vitest';
import { Turn } from '../../src/domain/turn.js';
import { REPLY_TIME_LIMIT_MS, createExchangeTurn } from '../../src/application/exchange-turn.use-case.js';
import type { BeginTurn } from '../../src/application/begin-turn.use-case.js';
import type { CompleteTurnUseCase } from '../../src/application/complete-turn.use-case.js';
import type { ConversationHistoryRead } from '../../src/application/conversation-history-read.js';
import type { ProduceConversationReply, ReplyPart } from '../../src/application/produce-conversation-reply.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
const pending = Turn.accept({ id: turnId, text: '  domanda  ', acceptedAt: new Date(1234) }).snapshot();
const englishFailure = "I can't complete the response.";
const italianFailure = 'Non riesco a completare la risposta.';
const text = (value: string): ReplyPart => ({ kind: 'text', text: value });
const expectation = (expectsReply: boolean): ReplyPart => ({ kind: 'reply_expectation', expectsReply });
const responder = (agent: string): ReplyPart => ({ kind: 'agent', agent });

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
      reply: { async *produce() { yield text('prima'); yield text('seconda'); yield expectation(false); } },
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
        yield text('Buon');
        yield text('giorno');
        yield expectation(false);
      },
    };
    const progress: string[] = [];
    const exchange = createExchangeTurn({ ...deps, reply });
    expect(await exchange({ text: '  domanda  ' }, {
      admitted(id, turn) { progress.push(`admitted:${id}:${turn}`); },
      delta(text) { progress.push(text); },
    })).toEqual({ ok: true, value: { conversationId, turnId, outcome: 'answered', expectsReply: false } });
    expect(deps.calls).toEqual(['admit', 'history', 'produce', 'complete']);
    expect(progress).toEqual([`admitted:${conversationId}:${turnId}`, 'Buon', 'giorno']);
    expect(deps.outcomes).toEqual([{ kind: 'answer', text: 'Buongiorno' }]);
  });

  it('returns the structured reply expectation with the saved answer', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({ ...deps, reply: {
      async *produce() {
        yield text('Vuoi ');
        yield text('altro?');
        yield expectation(true);
      },
    } });
    expect(await exchange({ text: '  domanda  ' })).toEqual({
      ok: true, value: { conversationId, turnId, outcome: 'answered', expectsReply: true },
    });
    expect(deps.outcomes).toEqual([{ kind: 'answer', text: 'Vuoi altro?' }]);
  });

  it.each<[string, ReplyPart[]]>([
    ['absent', [text('Risposta?')]],
    ['repeated', [text('Risposta?'), expectation(true), expectation(false)]],
    ['followed by text', [text('Risposta'), expectation(false), text('?')]],
    ['not boolean', [text('Risposta?'),
      { kind: 'reply_expectation', expectsReply: 'yes' } as unknown as ReplyPart]],
  ])('concludes the turn as failed when the reply expectation is %s', async (_label, parts) => {
    const deps = setup();
    const exchange = createExchangeTurn({ ...deps, reply: {
      async *produce() { yield* parts; },
    } });
    expect(await exchange({ text: '  domanda  ' })).toEqual({
      ok: true, value: { conversationId, turnId, outcome: 'failed', error: englishFailure,
        cause: expect.any(Error) },
    });
    expect(deps.outcomes).toEqual([{ kind: 'error', message: englishFailure }]);
  });

  it('signals the end of production before storing the answer', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({ ...deps, reply: {
      async *produce() { yield text('fatto'); yield expectation(false); },
    } });
    await exchange({ text: '  domanda  ' }, { produced() { deps.calls.push('produced'); } });
    expect(deps.calls).toEqual(['admit', 'history', 'produced', 'complete']);
  });

  it('continues after the observer disconnects and records a safe error after a partial reply', async () => {
    const deps = setup();
    const failure = new Error('private agent detail');
    const reply: ProduceConversationReply = {
      async *produce() {
        yield text('parziale');
        throw failure;
      },
    };
    const exchange = createExchangeTurn({ ...deps, reply });
    expect(await exchange({ text: '  domanda  ' }, {
      async admitted() { throw new Error('client disconnected'); },
      async delta() { throw new Error('client disconnected'); },
    })).toEqual({ ok: true, value: {
      conversationId, turnId, outcome: 'failed', error: englishFailure, cause: failure,
    } });
    // The cause reaches the adapter for diagnostics, never the stored outcome.
    expect(deps.outcomes).toEqual([{ kind: 'error', message: englishFailure }]);
  });

  it.each(['admitted', 'delta'] as const)('keeps the complete answer after a technical %s notification failure', async failureAt => {
    const deps = setup();
    const delivered: string[] = [];
    const exchange = createExchangeTurn({
      ...deps,
      reply: { async *produce() { yield text('prima'); yield text('seconda'); yield expectation(false); } },
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

    expect(result).toEqual({ ok: true, value: { conversationId, turnId, outcome: 'answered', expectsReply: false } });
    expect(deps.outcomes).toEqual([{ kind: 'answer', text: 'primaseconda' }]);
    expect(delivered).toEqual(['prima', 'seconda']);
  });

  it('requests error completion when history cannot be read', async () => {
    const deps = setup();
    const failure = new Error('private archive detail');
    const exchange = createExchangeTurn({
      ...deps,
      history: { async find() { throw failure; } },
      reply: { async *produce() { throw new Error('must not run'); } },
    });
    expect(await exchange({ text: '  domanda  ' })).toEqual({ ok: true, value: {
      conversationId, turnId, outcome: 'failed', error: englishFailure, cause: failure,
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
      conversationId, turnId, outcome: 'failed', error: italianFailure, cause: expect.any(Error),
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
    for (const kind of ['occupied', 'conversation_not_found', 'temporarily_unavailable'] as const) {
      const deps = setup();
      const exchange = createExchangeTurn({
        ...deps,
        begin: async () => ({ ok: false, error: { kind } }),
        reply: { async *produce() { throw new Error('must not run'); } },
      });
      expect(await exchange({ text: '  domanda  ' })).toEqual({ ok: false, error: { kind } });
      expect(deps.calls).toEqual([]);
    }
  });

  it('does not report success when persistence of the answer fails', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({
      ...deps,
      complete: async () => { throw new Error('disk failed'); },
      reply: { async *produce() { yield text('risposta'); yield expectation(false); } },
    });
    await expect(exchange({ text: '  domanda  ' })).rejects.toThrow('disk failed');
  });

  it('discards a provider result arriving after shutdown without writing to the archive', async () => {
    const deps = setup();
    const started = deferred();
    const release = deferred();
    let stopping = false;
    const deltas: string[] = [];
    const exchange = createExchangeTurn({ ...deps, reply: { async *produce() {
      started.resolve();
      await release.promise;
      yield text('too late');
    } } });
    const result = exchange({ text: '  domanda  ' }, { delta(text) { deltas.push(text); } },
      () => stopping);
    await started.promise;
    stopping = true;
    release.resolve();
    expect(await result).toEqual({ ok: true, value: { conversationId, turnId,
      outcome: 'interrupted' } });
    expect(deltas).toEqual([]);
    expect(deps.outcomes).toEqual([]);
  });

  // Verification: Prova della continuità dell'agente nella conversazione
  it('records the agent that formulated the answer with the stored outcome', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({ ...deps, reply: { async *produce() {
      yield responder('home'); yield text('Fatto.'); yield expectation(false);
    } } });
    expect(await exchange({ text: '  domanda  ' })).toEqual({ ok: true, value: {
      conversationId, turnId, outcome: 'answered', expectsReply: false } });
    expect(deps.outcomes).toEqual([{ kind: 'answer', text: 'Fatto.', agent: 'home' }]);
  });

  // Verification: Prova della continuità dell'agente nella conversazione
  it.each<[string, ReplyPart[]]>([
    ['repeated', [responder('home'), responder('home'), text('Fatto.'), expectation(false)]],
    ['empty', [responder(''), text('Fatto.'), expectation(false)]],
    ['after text', [text('Fatto.'), responder('home'), expectation(false)]],
    ['after the reply expectation', [text('Fatto.'), expectation(false), responder('home')]],
  ])('fails the turn when the responding agent is %s', async (_label, parts) => {
    const deps = setup();
    const exchange = createExchangeTurn({ ...deps, reply: { async *produce() { yield* parts; } } });
    expect(await exchange({ text: '  domanda  ' })).toMatchObject({ ok: true, value: { outcome: 'failed' } });
    expect(deps.outcomes).toEqual([{ kind: 'error', message: englishFailure }]);
  });

  // Verification: Prova del tempo massimo della produzione della risposta
  it('fails a stalled reply at the time limit without waiting for the producer', async () => {
    const deps = setup();
    let seen: AbortSignal | undefined;
    const exchange = createExchangeTurn({ ...deps, replyTimeLimitMs: 20, reply: { async *produce(_history, signal) {
      seen = signal;
      yield text('parziale');
      await new Promise(() => { /* stalled stream that ignores the signal */ });
    } } });
    const deltas: string[] = [];
    const result = await exchange({ text: '  domanda  ' }, { delta(value) { deltas.push(value); } });
    expect(result).toEqual({ ok: true, value: { conversationId, turnId, outcome: 'failed',
      error: englishFailure, cause: expect.objectContaining({ message: 'Reply production time limit exceeded' }) } });
    expect(seen?.aborted).toBe(true);
    expect(deltas).toEqual(['parziale']);
    // The occupancy is released by completing the turn with the error, never with the partial text.
    expect(deps.outcomes).toEqual([{ kind: 'error', message: englishFailure }]);
  });

  // Verification: Prova del tempo massimo della produzione della risposta
  it('reports the time limit as the cause when the producer reacts to the signal', async () => {
    const deps = setup();
    const exchange = createExchangeTurn({ ...deps, replyTimeLimitMs: 20, reply: { async *produce(_history, signal) {
      await new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted by provider')), { once: true });
      });
      yield text('unreachable');
    } } });
    expect(await exchange({ text: '  domanda  ' })).toMatchObject({ ok: true, value: { outcome: 'failed',
      cause: { message: 'Reply production time limit exceeded' } } });
  });

  // Verification: Prova del tempo massimo della produzione della risposta
  it('leaves the signal untouched when the reply finishes in time', async () => {
    const deps = setup();
    let seen: AbortSignal | undefined;
    const exchange = createExchangeTurn({ ...deps, replyTimeLimitMs: 20, reply: { async *produce(_history, signal) {
      seen = signal;
      yield text('in tempo'); yield expectation(false);
    } } });
    expect(await exchange({ text: '  domanda  ' })).toMatchObject({ ok: true, value: { outcome: 'answered' } });
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(seen?.aborted).toBe(false);
  });

  // Verification: Prova del tempo massimo della produzione della risposta
  it('keeps an interrupted turn interrupted when the time limit expires', async () => {
    const deps = setup();
    // The session closes while the producer is already stalled.
    let closed = false;
    const exchange = createExchangeTurn({ ...deps, replyTimeLimitMs: 20, reply: { async *produce() {
      closed = true;
      await new Promise(() => { /* stalled */ });
      yield text('unreachable');
    } } });
    expect(await exchange({ text: '  domanda  ' }, undefined, () => closed)).toEqual({ ok: true, value: {
      conversationId, turnId, outcome: 'interrupted' } });
    expect(deps.outcomes).toEqual([]);
  });

  // Verification: Prova del tempo massimo della produzione della risposta
  it('allows 30 seconds when no test limit is given', async () => {
    expect(REPLY_TIME_LIMIT_MS).toBe(30_000);
    vi.useFakeTimers();
    try {
      const deps = setup();
      let seen: AbortSignal | undefined;
      const exchange = createExchangeTurn({ ...deps, reply: { async *produce(_history, signal) {
        seen = signal;
        await new Promise(() => { /* stalled */ });
        yield text('unreachable');
      } } });
      let settled = false;
      const result = exchange({ text: '  domanda  ' }).finally(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(29_999);
      expect([settled, seen?.aborted]).toEqual([false, false]);
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toMatchObject({ ok: true, value: { outcome: 'failed' } });
      expect(seen?.aborted).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
