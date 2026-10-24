import type { FastifyInstance } from 'fastify';
import type { GetConversation } from '../../../application/get-conversation.use-case.js';
import type { ListConversations } from '../../../application/list-conversations.use-case.js';
import { createGetConversationHandler } from './get-conversation/get-conversation.handler.js';
import { registerGetConversationRoute } from './get-conversation/get-conversation.route.adapter.js';
import { registerUnversionedGetConversationRoute } from './get-conversation/get-conversation.unversioned-route.adapter.js';
import { createListConversationsHandler } from './list-conversations/list-conversations.handler.js';
import { registerListConversationsRoute } from './list-conversations/list-conversations.route.adapter.js';
import { registerUnversionedListConversationsRoute }
  from './list-conversations/list-conversations.unversioned-route.adapter.js';

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

/**
 * Aggregator of the same routes in the API without a version, registered by the application under `/api` while a
 * client release uses it: same handlers, different paths and error bodies.
 */
export function unversionedConversationRoutes(dependencies: ConversationRouteDependencies & Readonly<{
  language: 'en' | 'it';
}>): RouteRegistration {
  const list = createListConversationsHandler(dependencies);
  const get = createGetConversationHandler(dependencies.getConversation);
  return scope => {
    registerUnversionedListConversationsRoute(scope, list, dependencies.language);
    registerUnversionedGetConversationRoute(scope, get, dependencies.language);
  };
}
