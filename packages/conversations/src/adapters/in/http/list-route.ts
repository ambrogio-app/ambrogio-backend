import type { FastifyInstance, FastifyReply } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import type { ConversationListCursor } from '../../../application/conversation-list-read.js';
import type { ListConversations } from '../../../application/list-conversations.use-case.js';

type Language = 'en' | 'it';

const messages = {
  invalid: { en: 'Invalid pagination request.', it: 'Richiesta di paginazione non valida.' },
  failure: { en: "I can't complete the response.", it: 'Non riesco a completare la risposta.' },
} as const;

const listQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.String()),
}, { additionalProperties: false });
type ListQuery = Static<typeof listQuerySchema>;

function publicError(reply: FastifyReply, status: number, message: string): FastifyReply {
  return reply.code(status).header('Cache-Control', 'no-store').type('application/json').send({ error: message });
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown conversation list failure', { cause: value });
}

function encodeCursor(cursor: ConversationListCursor): string {
  return Buffer.from(JSON.stringify({ id: cursor.id, lastActivityAt: cursor.lastActivityAt.toISOString() }), 'utf8')
    .toString('base64url');
}

function decodeCursor(value: unknown): ConversationListCursor | undefined {
  if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.toString('base64url') !== value) return undefined;
    const json = decoded.toString('utf8');
    if (!Buffer.from(json, 'utf8').equals(decoded)) return undefined;
    const cursor: unknown = JSON.parse(json);
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    const fields = cursor as Record<string, unknown>;
    if (Object.keys(fields).length !== 2 || typeof fields.id !== 'string' || fields.id.length === 0
      || typeof fields.lastActivityAt !== 'string') return undefined;
    const lastActivityAt = new Date(fields.lastActivityAt);
    if (!Number.isFinite(lastActivityAt.getTime())
      || lastActivityAt.toISOString() !== fields.lastActivityAt) return undefined;
    return { id: fields.id, lastActivityAt };
  } catch {
    return undefined;
  }
}

function parseQuery(query: ListQuery, maxPageSize: number):
  Readonly<{ after?: ConversationListCursor; limit?: number }> | undefined {
  const input: { after?: ConversationListCursor; limit?: number } = {};
  if (query.cursor !== undefined) {
    const after = decodeCursor(query.cursor);
    if (!after) return undefined;
    input.after = after;
  }
  if (query.limit !== undefined) {
    if (!/^[0-9]+$/.test(query.limit)) return undefined;
    const limit = Number(query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxPageSize) return undefined;
    input.limit = limit;
  }
  return input;
}

/** Serve bounded, current pages of the persisted conversation list. */
export function registerListRoute(server: FastifyInstance, options: Readonly<{
  listConversations: ListConversations;
  maxPageSize: number;
  language: Language;
}>): void {
  server.get<{ Querystring: ListQuery }>('/api/conversations', {
    schema: { querystring: listQuerySchema },
    errorHandler(error, request, reply) {
      if (error.statusCode === 400) return publicError(reply, 400, messages.invalid[options.language]);
      request.log.error({ event: 'conversation_list_http_failed', err: normalizeError(error) },
        'HTTP request failed');
      return publicError(reply, 500, messages.failure[options.language]);
    },
  }, async (request, reply) => {
    const input = parseQuery(request.query, options.maxPageSize);
    if (!input) return publicError(reply, 400, messages.invalid[options.language]);
    try {
      const page = await options.listConversations(input);
      return reply.code(200).header('Cache-Control', 'no-store').type('application/json').send({
        items: page.items.map(item => ({ id: item.id, lastActivityAt: item.lastActivityAt.toISOString() })),
        nextCursor: page.next ? encodeCursor(page.next) : null,
      });
    } catch (error) {
      request.log.error({ event: 'conversation_list_http_failed', err: normalizeError(error) },
        'HTTP request failed');
      return publicError(reply, 500, messages.failure[options.language]);
    }
  });
}
