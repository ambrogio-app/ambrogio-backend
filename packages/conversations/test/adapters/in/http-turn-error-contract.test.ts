import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerTurnRoute, TURN_BODY_LIMIT } from '../../../src/adapters/in/http/turn-route.js';
import type { ExchangeTurn } from '../../../src/application/exchange-turn.use-case.js';

const route = '/api/conversations/turns';

describe('text turn HTTP error contract', () => {
  it.each([
    { language: 'en', invalid: 'Invalid message.', missing: 'Conversation not found.',
      occupied: 'Another turn is in progress.', unavailable: 'Service temporarily unavailable.',
      tooLarge: 'Request too large.' },
    { language: 'it', invalid: 'Messaggio non valido.', missing: 'Conversazione non trovata.',
      occupied: 'Un altro turno è in corso.', unavailable: 'Servizio temporaneamente non disponibile.',
      tooLarge: 'Richiesta troppo grande.' },
  ] as const)('returns the complete pre-SSE error matrix in $language', async messages => {
    const exchange = vi.fn<ExchangeTurn>(async () => ({ ok: false, error: { kind: 'occupied' } }));
    const server = Fastify();
    registerTurnRoute(server, { exchange, language: messages.language });
    const post = (text: string) => server.inject({ method: 'POST', url: route,
      headers: { 'content-type': 'application/json' }, payload: { text } });
    const check = async (response: Awaited<ReturnType<typeof post>>, status: number, message: string) => {
      expect(response.statusCode).toBe(status);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.json()).toEqual({ error: message });
      expect(response.body).not.toContain('event:');
    };
    try {
      await check(await post('  '), 400, messages.invalid);
      expect(exchange).not.toHaveBeenCalled();

      const tooLarge = 'x'.repeat(TURN_BODY_LIMIT - Buffer.byteLength('{"text":""}') + 1);
      await check(await post(tooLarge), 413, messages.tooLarge);
      expect(exchange).not.toHaveBeenCalled();

      for (const [kind, status, message] of [
        ['conversation_not_found', 404, messages.missing],
        ['occupied', 409, messages.occupied],
        ['temporarily_unavailable', 503, messages.unavailable],
      ] as const) {
        exchange.mockImplementationOnce(async input => {
          expect(input).toEqual({ text: '  nuovo   turno  ' });
          return { ok: false, error: { kind } };
        });
        await check(await post('  nuovo   turno  '), status, message);
      }
      expect(exchange).toHaveBeenCalledTimes(3);
    } finally {
      await server.close();
    }
  });
});
