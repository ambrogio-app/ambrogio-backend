import type { FastifyInstance } from 'fastify';
import { sessionProtocol, sessionRoute,
  type ConversationSessions } from '@ambrogio/conversations/adapters/in/session/conversation-session';

function offeredProtocols(header: string | string[] | undefined): string[] {
  const values = Array.isArray(header) ? header : header === undefined ? [] : [header];
  return values.flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean);
}

/** Accept the conversation WebSocket only for `ambrogio.v1` and an allowed or absent Origin. */
export function registerSessionRoute(server: FastifyInstance, sessions: ConversationSessions,
  allowedOrigins: readonly string[]): void {
  server.get(sessionRoute, { websocket: true, preValidation(request, reply, done) {
    const origin = request.headers.origin;
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      reply.code(403).header('Cache-Control', 'no-store').send({ error: 'Origin not allowed.' });
      return;
    }
    if (!offeredProtocols(request.headers['sec-websocket-protocol']).includes(sessionProtocol)) {
      reply.code(400).header('Cache-Control', 'no-store').send({ error: 'Unsupported subprotocol.' });
      return;
    }
    done();
  } }, socket => { sessions.attach(socket); });
}
