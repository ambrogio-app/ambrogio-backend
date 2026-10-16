import { ProjectError } from '../../../project-error.js';
import { Readable } from 'node:stream';
import { createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import type { ExchangeTurn } from '../../../application/exchange-turn.use-case.js';

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

const turnBodySchema = Type.Object({
  text: Type.String(),
  conversationId: Type.Optional(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
type TurnBody = Static<typeof turnBodySchema>;

function publicError(reply: FastifyReply, status: number, message: string): FastifyReply {
  return reply.code(status).header('Cache-Control', 'no-store').type('application/json').send({ error: message });
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown conversation turn failure', { cause: value });
}

/** Register the textual turn ingress after conversation resources have been prepared. */
export function registerTurnRoute(server: FastifyInstance, options: Readonly<{
  exchange: ExchangeTurn;
  language: Language;
}>): Readonly<{ stopAccepting(): Promise<void> }> {
  const message = (kind: PublicError) => messages[kind][options.language];
  let acceptingTurns = true;
  const admissions = new Set<Promise<unknown>>();
  const streams = new Set<Readable>();
  const loggedDeliveryErrors = new WeakMap<object, FastifyRequest>();

  server.route<{ Body: TurnBody }>({
    method: 'POST',
    url: '/api/conversations/turns',
    schema: { body: turnBodySchema },
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
    async handler(request, reply) {
      if (!acceptingTurns) return publicError(reply, 503, message('unavailable'));
      const input = request.body;
      if (!input || input.text.trim().length === 0) {
        return publicError(reply, 400, message('invalid'));
      }

      let clientDisconnected = false;
      reply.raw.once('close', () => { clientDisconnected = !reply.raw.writableEnded; });
      const logDeliveryFailure = (error: unknown) => {
        if (clientDisconnected || reply.raw.destroyed) return;
        if (typeof error === 'object' && error !== null) {
          if (loggedDeliveryErrors.get(error) === request) return;
          loggedDeliveryErrors.set(error, request);
        }
        request.log.error({ event: 'conversation_turn_sse_delivery_failed', err: normalizeError(error) },
          'Conversation turn SSE delivery failed');
      };
      let signalAdmitted!: () => void;
      const admitted = new Promise<void>(resolve => { signalAdmitted = resolve; });
      let wasAdmitted = false;
      let textBlockId = '';
      let execution!: ReturnType<ExchangeTurn>;
      const uiStream = createUIMessageStream({
        execute: async ({ writer }) => {
          execution = Promise.resolve().then(() => options.exchange(input, {
            admitted(conversationId, turnId) {
              wasAdmitted = true;
              textBlockId = turnId;
              writer.write({ type: 'start', messageId: generateId(),
                messageMetadata: { conversationId, turnId } });
              writer.write({ type: 'text-start', id: turnId });
              signalAdmitted();
            },
            delta(text) { writer.write({ type: 'text-delta', id: textBlockId, delta: text }); },
          }, () => !acceptingTurns));
          try {
            const result = await execution;
            if (!result.ok) return;
            writer.write({ type: 'text-end', id: result.value.turnId });
            if (result.value.outcome === 'answered') {
              writer.write({ type: 'finish', finishReason: 'stop',
                messageMetadata: { turnStatus: 'answered' } });
              writer.setOutcome({ status: 'completed' });
            } else if (result.value.outcome === 'failed') {
              writer.write({ type: 'error', errorText: result.value.error });
              writer.setOutcome({ status: 'failed' });
            } else {
              writer.write({ type: 'abort' });
              writer.setOutcome({ status: 'aborted' });
            }
          } catch (error) {
            if (wasAdmitted) {
              acceptingTurns = false;
              request.log.error({ event: 'conversation_turn_completion_failed', err: normalizeError(error) },
                'Conversation turn completion failed');
              writer.write({ type: 'error', errorText: message('failure') });
              writer.setOutcome({ status: 'failed' });
            }
          }
        },
        onError: () => message('failure'),
      });

      let first: 'admitted' | 'finished';
      const admission = Promise.race([
        admitted.then(() => 'admitted' as const),
        execution.then(() => 'finished' as const),
      ]);
      admissions.add(admission);
      try {
        first = await admission;
      } catch (error) {
        request.log.error({ event: 'conversation_turn_admission_failed', err: normalizeError(error) },
          'Conversation turn admission failed');
        return publicError(reply, 500, message('failure'));
      } finally {
        admissions.delete(admission);
      }

      if (first === 'finished') {
        const result = await execution;
        if (result.ok) throw new ProjectError('Conversation turn finished without an admission notice');
        switch (result.error.kind) {
          case 'occupied': return publicError(reply, 409, message('occupied'));
          case 'conversation_not_found': return publicError(reply, 404, message('missing'));
          case 'temporarily_unavailable': return publicError(reply, 503, message('unavailable'));
        }
      }

      const response = createUIMessageStreamResponse({ stream: uiStream,
        headers: { 'Cache-Control': 'no-store' } });
      for (const [key, value] of response.headers) reply.header(key, value);
      const stream = Readable.from(response.body! as AsyncIterable<Uint8Array>);
      streams.add(stream);
      stream.once('close', () => { streams.delete(stream); });
      stream.on('error', logDeliveryFailure);
      reply.send(stream);
      return reply;
    },
  });
  return { async stopAccepting() {
    acceptingTurns = false;
    for (const stream of streams) stream.destroy();
    await Promise.allSettled([...admissions]);
  } };
}
