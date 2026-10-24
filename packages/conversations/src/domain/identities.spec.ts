import { describe, expect, expectTypeOf, it } from 'vitest';
import { ConversationId, TurnId } from './identities.js';

const first = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
const second = '79e437a8-c11a-48ba-b476-e4fd4712ea58';

describe('identity Value Objects', () => {
  // Verification: Prova del comportamento dei Value Object di identità
  it('compare by value and keep the value they were created with', () => {
    for (const Identity of [ConversationId, TurnId]) {
      const one = Identity.create(first);
      const same = Identity.create(first);
      const other = Identity.create(second);
      expect(one).not.toBe(same);
      expect(one.equals(same as never)).toBe(true);
      expect(one.equals(other as never)).toBe(false);
      expect(one.value).toBe(first);
      expect(() => { (one as unknown as { value: string }).value = second; }).toThrow(TypeError);
      expect(one.value).toBe(first);
      expect(Object.keys(one)).toEqual([]);
    }
  });

  // Verification: Prova del comportamento dei Value Object di identità
  it('accept only canonical UUID v4 values, also when they come from storage', () => {
    const invalid = ['', 'conversation-1', first.toUpperCase(), ` ${first}`, `${first} `,
      'dc89cb5e-e695-13cc-8a04-917316771ea4', 'dc89cb5e-e695-43cc-7a04-917316771ea4', '00000000-0000-0000-0000-000000000000'];
    for (const Identity of [ConversationId, TurnId]) {
      expect(Identity.isValid(first)).toBe(true);
      for (const value of [...invalid, 42, undefined]) {
        expect(Identity.isValid(value), String(value)).toBe(false);
        expect(() => Identity.create(value as string), String(value)).toThrow(/Invalid (conversation|turn) identity/);
      }
    }
  });

  // Verification: Prova della struttura TypeScript del Domain
  it('are distinct types that cannot be exchanged', () => {
    expectTypeOf<ConversationId>().not.toEqualTypeOf<TurnId>();
    const conversation = ConversationId.create(first);
    const turn = TurnId.create(first);
    // @ts-expect-error a turn identity is not a conversation identity
    const wrongConversation: ConversationId = turn;
    // @ts-expect-error a conversation identity is not a turn identity
    const wrongTurn: TurnId = conversation;
    expect(() => {
      // @ts-expect-error equality is typed on the identity's own class
      conversation.equals(turn);
    }).toThrow(TypeError);
    // @ts-expect-error the constructor is private: identities are built only by `create`
    void new ConversationId(first);
    expect([wrongConversation, wrongTurn]).toHaveLength(2);
  });
});
