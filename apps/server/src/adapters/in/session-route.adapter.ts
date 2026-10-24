import type { FastifyInstance } from 'fastify';
import { sendProblem, type ProblemDetails } from '@ambrogio/conversations/adapters/in/http/problem-details';
import { sessionProtocol, sessionRoute,
  type ConversationSessions } from '@ambrogio/conversations/adapters/in/session/conversation-session';

// The session opening rejections of «Catalogo dei problemi di protocollo HTTP».
const originNotAllowed: ProblemDetails = { type: '/problems/origin-not-allowed', title: 'Origin not allowed',
  status: 403 };
const unsupportedSubprotocol: ProblemDetails = { type: '/problems/unsupported-subprotocol',
  title: 'Unsupported subprotocol', status: 400 };

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
      sendProblem(reply, originNotAllowed);
      return;
    }
    if (!offeredProtocols(request.headers['sec-websocket-protocol']).includes(sessionProtocol)) {
      sendProblem(reply, unsupportedSubprotocol);
      return;
    }
    done();
  } }, (socket, request) => { sessions.attach(socket, request.log); });
}
