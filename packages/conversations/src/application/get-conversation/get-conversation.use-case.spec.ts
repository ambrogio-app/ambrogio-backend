import { describe, expect, it } from 'vitest';
import type { ConversationHistoryRead } from '../conversation-history-read.port.js';
import { createGetConversation } from './get-conversation.use-case.js';

const conversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';

describe('get conversation use case', () => {
  it('returns the conversation without the agent and the actions of its turns, or the expected rejection', async () => {
    const history: ConversationHistoryRead = { async find(id) {
      if (id !== conversationId) return undefined;
      return { id, createdAt: new Date(1), lastActivityAt: new Date(2), turns: [
        { id: 't1', text: 'ciao', acceptedAt: new Date(1), status: 'answered', answer: 'ok', finishedAt: new Date(2),
          agent: 'generic', actions: [{ tool: 'search', input: {}, output: null }] },
        { id: 't2', text: 'altro', acceptedAt: new Date(2), status: 'pending' },
      ] };
    } };
    const getConversation = createGetConversation(history);
    expect(await getConversation({ conversationId })).toEqual({ ok: true, value: { id: conversationId,
      createdAt: new Date(1), lastActivityAt: new Date(2), turns: [
        { id: 't1', text: 'ciao', acceptedAt: new Date(1), status: 'answered', answer: 'ok', finishedAt: new Date(2) },
        { id: 't2', text: 'altro', acceptedAt: new Date(2), status: 'pending' },
      ] } });
    expect(await getConversation({ conversationId: 'missing' }))
      .toEqual({ ok: false, error: { kind: 'conversation_not_found' } });
  });

  // Verification: Prova della propagazione dei guasti inattesi
  it('rejects with the fault of the read port, kept by identity, instead of returning it as an outcome', async () => {
    const fault = new Error('read port fault');
    const getConversation = createGetConversation({ async find() { throw fault; } });
    await expect(getConversation({ conversationId })).rejects.toBe(fault);
  });
});
