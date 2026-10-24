import { describe, expect, it } from 'vitest';
import { createBeginTurn } from './begin-turn.use-case.js';
import type { ConversationWrite } from './conversation-write.port.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const turnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';

describe('begin turn use case', () => {
  it('supplies identities and one clock instant before admission, preserving text', async () => {
    const calls: string[] = [];
    const archive: ConversationWrite = {
      async admit(input) {
        calls.push('admit');
        expect(input.conversationId).toBe(conversationId);
        expect(input.createConversation).toBe(true);
        expect(input.turn.snapshot()).toMatchObject({ id: turnId, text: '  ciao  ', acceptedAt: new Date(1234) });
        return { ok: true, value: undefined };
      },
      async complete() { throw new Error('unused'); },
    };
    const values = [conversationId, turnId];
    const begin = createBeginTurn({
      archive,
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
      ['conversation_missing', 'conversation_not_found'],
      ['archive_busy', 'temporarily_unavailable'],
    ] as const) {
      const archive: ConversationWrite = {
        async admit(input) {
          expect(input.createConversation).toBe(false);
          return { ok: false, error: { kind: archiveKind } };
        },
        async complete() { throw new Error('unused'); },
      };
      const begin = createBeginTurn({
        archive,
        identifiers: { next: () => turnId },
        clock: { now: () => new Date(1234) },
      });
      expect(await begin({ conversationId, text: 'ciao' })).toEqual({ ok: false, error: { kind: useCaseKind } });
    }
  });
});
