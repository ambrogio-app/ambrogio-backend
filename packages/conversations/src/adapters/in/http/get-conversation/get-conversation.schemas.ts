import { Type, type Static } from '@sinclair/typebox';
import type { ProblemDetails } from '../problem-details.js';

/** Path parameters of `GET /conversations/:conversationId`. */
export const getConversationParamsSchema = Type.Object({
  conversationId: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type GetConversationParams = Static<typeof getConversationParamsSchema>;

const turnBase = { id: Type.String(), text: Type.String(), acceptedAt: Type.String() };
export const conversationTurnSchema = Type.Union([
  Type.Object({ ...turnBase, status: Type.Literal('pending') }, { additionalProperties: false }),
  Type.Object({ ...turnBase, status: Type.Literal('answered'), answer: Type.String(), finishedAt: Type.String() },
    { additionalProperties: false }),
  Type.Object({ ...turnBase, status: Type.Literal('failed'), error: Type.String(), finishedAt: Type.String() },
    { additionalProperties: false }),
  Type.Object({ ...turnBase, status: Type.Literal('interrupted'), finishedAt: Type.String() },
    { additionalProperties: false }),
]);
export type ConversationTurnBody = Static<typeof conversationTurnSchema>;

export const conversationSchema = Type.Object({
  id: Type.String(),
  createdAt: Type.String(),
  lastActivityAt: Type.String(),
  turns: Type.Array(conversationTurnSchema),
}, { additionalProperties: false });
export type ConversationBody = Static<typeof conversationSchema>;

export const conversationNotFoundProblemSchema = Type.Object({
  type: Type.Literal('/problems/conversation-not-found'),
  title: Type.Literal('Conversation not found'),
  status: Type.Literal(404),
}, { additionalProperties: false });
export const conversationNotFoundProblem: ProblemDetails & Static<typeof conversationNotFoundProblemSchema> = {
  type: '/problems/conversation-not-found', title: 'Conversation not found', status: 404,
};
