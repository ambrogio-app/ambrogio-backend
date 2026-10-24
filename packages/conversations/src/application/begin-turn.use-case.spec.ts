import { describe, expect, it } from 'vitest';
import { createBeginTurn } from './begin-turn.use-case.js';
import type { ConversationLookup } from './conversation-lookup.port.js';
import type { TurnRepository } from './turn-repository.port.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';

const unused = async () => { throw new Error('unused'); };
const lookup = (exists: boolean, calls: string[] = []): ConversationLookup => ({
  async exists(id) { calls.push(`exists ${id.value}`); return exists; },
});

describe('begin turn use case', () => {
  it('supplies identities and one clock instant before admission, preserving text', async () => {
    const calls: string[] = [];
    const turns: TurnRepository = {
      async admit(input) {
        calls.push('admit');
        expect(input.conversation).toBe('new');
        expect(input.turn.id.value).toBe(turnId);
        expect(input.turn.conversationId.value).toBe(conversationId);
        expect(input.turn.text).toBe('  ciao  ');
        expect(input.turn.acceptedAt).toEqual(new Date(1234));
        expect(input.turn.status).toBe('pending');
        return { ok: true, value: undefined };
      },
      find: unused, findPending: unused, saveConclusion: unused,
    };
    const values = [conversationId, turnId];
    const begin = createBeginTurn({
      turns,
      conversations: lookup(true, calls),
      identifiers: { next: () => { calls.push('id'); return values.shift()!; } },
      clock: { now: () => { calls.push('time'); return new Date(1234); } },
    });
    expect(await begin({ text: '  ciao  ' })).toEqual({
      ok: true, value: { conversationId, turnId, acceptedAt: new Date(1234) },
    });
    expect(calls).toEqual(['id', 'id', 'time', 'admit']);
  });

  it('maps each expected archive refusal into its own public use-case variant', async () => {
    for (const [archiveKind, useCaseKind] of [
      ['conversation_occupied', 'occupied'],
      ['archive_busy', 'temporarily_unavailable'],
    ] as const) {
      const turns: TurnRepository = {
        async admit(input) {
          expect(input.conversation).toBe('existing');
          return { ok: false, error: { kind: archiveKind } };
        },
        find: unused, findPending: unused, saveConclusion: unused,
      };
      const begin = createBeginTurn({
        turns, conversations: lookup(true), identifiers: { next: () => turnId }, clock: { now: () => new Date(1234) },
      });
      expect(await begin({ conversationId, text: 'ciao' })).toEqual({ ok: false, error: { kind: useCaseKind } });
    }
  });

  // Verification: Prova della separazione dei contratti di lettura
  it('checks the requested conversation through the lookup port before admitting a turn', async () => {
    const calls: string[] = [];
    const turns: TurnRepository = {
      async admit() { calls.push('admit'); return { ok: true, value: undefined }; },
      find: unused, findPending: unused, saveConclusion: unused,
    };
    const begin = (exists: boolean) => createBeginTurn({
      turns, conversations: lookup(exists, calls), identifiers: { next: () => turnId }, clock: { now: () => new Date(1) },
    });
    expect(await begin(false)({ conversationId, text: 'ciao' }))
      .toEqual({ ok: false, error: { kind: 'conversation_not_found' } });
    for (const value of ['conversation-1', conversationId.toUpperCase(), '']) {
      expect(await begin(true)({ conversationId: value, text: 'ciao' }))
        .toEqual({ ok: false, error: { kind: 'conversation_not_found' } });
    }
    expect(calls).toEqual([`exists ${conversationId}`]);
    expect(await begin(true)({ conversationId, text: 'ciao' })).toMatchObject({ ok: true, value: { conversationId } });
    expect(calls).toEqual([`exists ${conversationId}`, `exists ${conversationId}`, 'admit']);
  });
});
