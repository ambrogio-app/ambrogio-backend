import { describe, expect, it } from 'vitest';
import { encodeTurnSseEvent } from '../../../src/adapters/in/http/sse-events.js';

describe('chat SSE event encoding', () => {
  it('encodes the conversation identity and each text increment as JSON SSE data', () => {
    expect(encodeTurnSseEvent({ kind: 'conversation', conversationId: 'conversation-1' }))
      .toBe('event: conversation\ndata: {"conversationId":"conversation-1"}\n\n');
    expect(encodeTurnSseEvent({ kind: 'delta', text: 'prima\nseconda' }))
      .toBe('event: delta\ndata: {"text":"prima\\nseconda"}\n\n');
  });

  it('uses distinct terminal events for success and failure', () => {
    expect(encodeTurnSseEvent({ kind: 'done' })).toBe('event: done\ndata: {}\n\n');
    expect(encodeTurnSseEvent({ kind: 'error', error: "I can't complete the response." }))
      .toBe('event: error\ndata: {"error":"I can\'t complete the response."}\n\n');
  });
});
