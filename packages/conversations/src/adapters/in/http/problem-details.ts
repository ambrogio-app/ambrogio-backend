import type { FastifyInstance, FastifyReply } from 'fastify';
import { Type, type TLiteral, type TObject } from '@sinclair/typebox';

/** Media type of every error response of the versioned API («Forma dei Problem Details dell'API HTTP»). */
export const problemMediaType = 'application/problem+json';

/** The members shared by every problem; a concrete problem declares its extensions in its own schema. */
export type ProblemDetails = Readonly<{ type: string; title: string; status: number; detail?: string }>;

type FixedProblemSchema = TObject<{ type: TLiteral<string>; title: TLiteral<string>; status: TLiteral<number> }>;

/** The closed schema of a problem whose `type`, `title` and `status` are fixed, without extensions. */
export function fixedProblemSchema(type: string, title: string, status: number): FixedProblemSchema {
  return Type.Object({ type: Type.Literal(type), title: Type.Literal(title), status: Type.Literal(status) },
    { additionalProperties: false });
}

/** Send a problem as a new object made of its declared members only, never cached. */
export function sendProblem(reply: FastifyReply, problem: ProblemDetails,
  headers: Readonly<Record<string, string>> = {}): FastifyReply {
  const body: Record<string, unknown> = { type: problem.type, title: problem.title, status: problem.status };
  if (problem.detail !== undefined) body.detail = problem.detail;
  return reply.code(problem.status).headers({ ...headers, 'cache-control': 'no-store' })
    .type(problemMediaType).send(body);
}

export const methodNotAllowedProblemSchema = fixedProblemSchema('about:blank', 'Method Not Allowed', 405);
const methodNotAllowed: ProblemDetails = { type: 'about:blank', title: 'Method Not Allowed', status: 405 };

/**
 * Answer `405` with `Allow` to the methods a read-only route of the versioned API does not accept. The answer is sent
 * before the body is read, so whatever body the request carries never turns it into another problem.
 */
export function rejectOtherMethods(scope: FastifyInstance, url: string): void {
  scope.route({ method: ['POST', 'PUT', 'PATCH', 'DELETE'], url,
    onRequest: async (_request, reply) => sendProblem(reply, methodNotAllowed, { allow: 'GET, HEAD' }),
    handler: (_request, reply) => sendProblem(reply, methodNotAllowed, { allow: 'GET, HEAD' }) });
}
