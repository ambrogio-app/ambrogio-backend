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
  return { calls, begin, history, complete, outcomes };
}

describe('conversation exchange use case', () => {
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
      conversationId, turnId, outcome: 'failed', error: 'Non riesco a completare la risposta.',
    } });
    expect(deps.outcomes).toEqual([{ kind: 'error', message: 'Non riesco a completare la risposta.' }]);
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
