import { describe, expect, it } from 'vitest';
import type { ConversationListRead } from '../conversation-list-read.port.js';
import { createListConversations } from './list-conversations.use-case.js';

describe('list conversations use case', () => {
  it('reads a page with the default or the requested size within the maximum', async () => {
    const requests: Array<readonly [unknown, number]> = [];
    const read: ConversationListRead = { async page(after, limit) { requests.push([after, limit]); return { items: [] }; } };
    const listConversations = createListConversations(read, 20, 100);
    const after = { id: 'c1', lastActivityAt: new Date(1) };
    expect(await listConversations({})).toEqual({ items: [] });
    await listConversations({ after, limit: 100 });
    expect(requests).toEqual([[undefined, 20], [after, 100]]);
  });

  // Verification: Prova della propagazione dei guasti inattesi
  it('rejects with the fault of the read port, kept by identity, instead of returning it as a page', async () => {
    const fault = new Error('read port fault');
    const listConversations = createListConversations({ async page() { throw fault; } });
    await expect(listConversations({})).rejects.toBe(fault);
  });
});
