import { Type, type Static } from '@sinclair/typebox';
import type { ProblemDetails } from '../problem-details.js';

/** Query of `GET /conversations`: both parameters stay strings until the route adapter converts them. */
export const listConversationsQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.String()),
}, { additionalProperties: false });
export type ListConversationsQuery = Static<typeof listConversationsQuerySchema>;

export const conversationPageSchema = Type.Object({
  items: Type.Array(Type.Object({ id: Type.String(), lastActivityAt: Type.String() },
    { additionalProperties: false })),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
}, { additionalProperties: false });
export type ConversationPageBody = Static<typeof conversationPageSchema>;

export const invalidPaginationProblemSchema = Type.Object({
  type: Type.Literal('/problems/invalid-pagination'),
  title: Type.Literal('Invalid pagination request'),
  status: Type.Literal(400),
  detail: Type.Literal('The cursor or the limit is not valid.'),
}, { additionalProperties: false });
export const invalidPaginationProblem: ProblemDetails & Static<typeof invalidPaginationProblemSchema> = {
  type: '/problems/invalid-pagination', title: 'Invalid pagination request', status: 400,
  detail: 'The cursor or the limit is not valid.',
};
