import { PassThrough } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ExchangeTurn } from '../../../application/exchange-turn.use-case.js';
import { encodeTurnSseEvent, type TurnSseEvent } from './sse-events.js';

type Language = 'en' | 'it';
type PublicError = 'invalid' | 'missing' | 'occupied' | 'unavailable' | 'oversized' | 'failure';

const messages: Record<PublicError, Record<Language, string>> = {
  invalid: { en: 'Invalid message.', it: 'Messaggio non valido.' },
  missing: { en: 'Conversation not found.', it: 'Conversazione non trovata.' },
  occupied: { en: 'Another turn is in progress.', it: 'Un altro turno è in corso.' },
  unavailable: { en: 'Service temporarily unavailable.', it: 'Servizio temporaneamente non disponibile.' },
  oversized: { en: 'Request too large.', it: 'Richiesta troppo grande.' },
  failure: { en: "I can't complete the response.", it: 'Non riesco a completare la risposta.' },
};

export const TURN_BODY_LIMIT = 65_536;

function publicError(reply: FastifyReply, status: number, message: string): FastifyReply {
  return reply.code(status).header('Cache-Control', 'no-store').type('application/json').send({ error: message });
}

function parsedTurn(body: unknown): { text: string; conversationId?: string } | undefined {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const fields = body as Record<string, unknown>;
  if (typeof fields.text !== 'string' || fields.text.trim().length === 0) return undefined;
  if (fields.conversationId !== undefined
    && (typeof fields.conversationId !== 'string' || fields.conversationId.length === 0)) return undefined;
  if (Object.keys(fields).some(key => key !== 'text' && key !== 'conversationId')) return undefined;
  return fields.conversationId === undefined
    ? { text: fields.text }
    : { text: fields.text, conversationId: fields.conversationId as string };
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown conversation turn failure', { cause: value });
}

async function writeEvent(stream: PassThrough, event: TurnSseEvent): Promise<void> {
  if (stream.destroyed || stream.writableEnded) return;
  if (stream.write(encodeTurnSseEvent(event), 'utf8')) return;
  await new Promise<void>(resolve => {
    const finish = () => {
      stream.off('drain', finish);
      stream.off('close', finish);
      resolve();
    };
    stream.once('drain', finish);
    stream.once('close', finish);
    if (stream.destroyed) finish();
  });
}

/** Register the textual turn ingress after conversation resources have been prepared. */
export function registerTurnRoute(server: FastifyInstance, options: Readonly<{
  exchange: ExchangeTurn;
  language: Language;
}>): Readonly<{ stopAccepting(): Promise<void> }> {
  const message = (kind: PublicError) => messages[kind][options.language];
  let acceptingTurns = true;
  const admissions = new Set<Promise<unknown>>();
  const streams = new Set<PassThrough>();
  const loggedDeliveryErrors = new WeakMap<object, FastifyRequest>();

  server.route({
    method: 'POST',
    url: '/api/conversations/turns',
    bodyLimit: TURN_BODY_LIMIT,
    errorHandler(error, request, reply) {
      if (loggedDeliveryErrors.get(error) === request) {
        return reply.raw.headersSent ? reply : publicError(reply, 500, message('failure'));
      }
      if (!acceptingTurns) return publicError(reply, 503, message('unavailable'));
      const code = (error as { code?: string }).code;
      if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') return publicError(reply, 413, message('oversized'));
      if (error.statusCode === 400 || error.statusCode === 415) {
        return publicError(reply, 400, message('invalid'));
      }
      request.log.error({ event: 'conversation_turn_http_failed', err: normalizeError(error) },
        'Conversation turn HTTP request failed');
      return publicError(reply, 500, message('failure'));
    },
    async handler(request: FastifyRequest, reply: FastifyReply) {
      if (!acceptingTurns) return publicError(reply, 503, message('unavailable'));
      const input = parsedTurn(request.body);
      if (!input) return publicError(reply, 400, message('invalid'));

      const stream = new PassThrough();
      streams.add(stream);
      stream.once('close', () => { streams.delete(stream); });
      let clientDisconnected = false;
      reply.raw.once('close', () => { clientDisconnected = !reply.raw.writableEnded; });
      const logDeliveryFailure = (error: unknown, streamError = false) => {
        if (!streamError && (clientDisconnected || reply.raw.destroyed)) return;
        if (typeof error === 'object' && error !== null) {
          if (loggedDeliveryErrors.get(error) === request) return;
          loggedDeliveryErrors.set(error, request);
        }
        request.log.error({ event: 'conversation_turn_sse_delivery_failed', err: normalizeError(error) },
          'Conversation turn SSE delivery failed');
      };
      stream.on('error', error => { logDeliveryFailure(error, true); });
      const deliver = async (event: TurnSseEvent) => {
        try { await writeEvent(stream, event); } catch (error) { logDeliveryFailure(error); }
      };
      let signalAdmitted!: () => void;
      const admitted = new Promise<void>(resolve => { signalAdmitted = resolve; });
      const execution = options.exchange(input, {
        async admitted(conversationId) {
          signalAdmitted();
          if (input.conversationId === undefined) {
            await deliver({ kind: 'conversation', conversationId });
          }
        },
        async delta(text) { await deliver({ kind: 'delta', text }); },
      }, () => !acceptingTurns);

      let first: 'admitted' | 'finished';
      const admission = Promise.race([
        admitted.then(() => 'admitted' as const),
        execution.then(() => 'finished' as const),
      ]);
      admissions.add(admission);
      try {
        first = await admission;
      } catch (error) {
        stream.destroy();
        request.log.error({ event: 'conversation_turn_admission_failed', err: normalizeError(error) },
          'Conversation turn admission failed');
        return publicError(reply, 500, message('failure'));
      } finally {
        admissions.delete(admission);
      }

      if (first === 'finished') {
        const result = await execution;
        stream.destroy();
        if (result.ok) throw new Error('Conversation turn finished without an admission notice');
        switch (result.error.kind) {
          case 'occupied': return publicError(reply, 409, message('occupied'));
          case 'conversation_not_found': return publicError(reply, 404, message('missing'));
          case 'temporarily_unavailable': return publicError(reply, 503, message('unavailable'));
        }
      }

      reply.header('Content-Type', 'text/event-stream; charset=utf-8')
        .header('Cache-Control', 'no-store');
      reply.send(stream);
      void execution.then(async result => {
        if (!result.ok) throw new Error('Admitted turn was later rejected');
        if (result.value.outcome === 'answered') await deliver({ kind: 'done' });
        else if (result.value.outcome === 'failed') {
          await deliver({ kind: 'error', error: result.value.error });
        }
      }).catch(async error => {
        acceptingTurns = false;
        request.log.error({ event: 'conversation_turn_completion_failed', err: normalizeError(error) },
          'Conversation turn completion failed');
        await deliver({ kind: 'error', error: message('failure') });
      }).finally(() => { stream.end(); });
      return reply;
    },
  });
  return { async stopAccepting() {
    acceptingTurns = false;
    for (const stream of streams) stream.end();
    await Promise.allSettled([...admissions]);
  } };
}
