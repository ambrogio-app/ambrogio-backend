import type { FastifyInstance } from 'fastify';
import type { GetConversation } from '../../../application/get-conversation.use-case.js';
import type { ListConversations } from '../../../application/list-conversations.use-case.js';
import { createGetConversationHandler } from './get-conversation/get-conversation.handler.js';
import { registerGetConversationRoute } from './get-conversation/get-conversation.route.adapter.js';
import { createListConversationsHandler } from './list-conversations/list-conversations.handler.js';
import { registerListConversationsRoute } from './list-conversations/list-conversations.route.adapter.js';

/** Registers routes in the Fastify scope the application gives it; dependencies are already built. */
export type RouteRegistration = (scope: FastifyInstance) => void;

export type ConversationRouteDependencies = Readonly<{
  listConversations: ListConversations;
  getConversation: GetConversation;
  maxPageSize: number;
}>;

/** Aggregator of the consultation routes of HTTP API `v1`, registered by the application under `/api/v1`. */
export function conversationApiRoutes(dependencies: ConversationRouteDependencies): RouteRegistration {
  const list = createListConversationsHandler(dependencies);
  const get = createGetConversationHandler(dependencies.getConversation);
  return scope => {
    registerListConversationsRoute(scope, list);
    registerGetConversationRoute(scope, get);
  };
}
