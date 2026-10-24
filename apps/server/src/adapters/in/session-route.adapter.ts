import type { FastifyInstance } from 'fastify';
import type { Logger } from '@ambrogio/conversations/adapters/in/logger';
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

/**
 * Accept the conversation WebSocket only for `ambrogio.v1` and an allowed or absent Origin; the session logs through
 * a logger derived from `log` with the `correlationId` of the opening request.
 */
export function registerSessionRoute(server: FastifyInstance, sessions: ConversationSessions,
  allowedOrigins: readonly string[], log: Logger): void {
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
  } }, (socket, request) => {
    sessions.attach(socket, log.child({ correlationId: request.id }));
  });
}
