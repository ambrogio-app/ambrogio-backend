import { ProjectError } from '@ambrogio/conversations/application/project-error';
import type { ConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import { SystemDeadlines } from '@ambrogio/conversations/adapters/out/system-deadlines';
import { UuidIdentifiers } from '@ambrogio/conversations/adapters/out/uuid-identifiers';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/sqlite/archive';
import { SqliteConversationHistoryRead } from '@ambrogio/conversations/adapters/out/sqlite/history-read';
import { SqliteConversationListRead } from '@ambrogio/conversations/adapters/out/sqlite/list-read';
import { SqliteTurnRepository } from '@ambrogio/conversations/adapters/out/sqlite/turn-repository';
import { SqliteConversationLookup } from '@ambrogio/conversations/adapters/out/sqlite/conversation-lookup';
import { createConversationSessions } from '@ambrogio/conversations/adapters/in/session/conversation-session';
import { createProtocolDecoder } from '@ambrogio/conversations/adapters/in/session/protocol-decoder';
import type { SpeechComponents } from '@ambrogio/conversations/adapters/in/session/speech-components';
import { conversationApiRoutes, unversionedConversationRoutes,
  type RouteRegistration } from '@ambrogio/conversations/adapters/in/http/conversation-routes';
import { createBeginTurn } from '@ambrogio/conversations/application/begin-turn';
import { createCompleteTurn } from '@ambrogio/conversations/application/complete-turn';
import { createInterruptPendingTurns } from '@ambrogio/conversations/application/interrupt-pending-turns';
import { createExchangeTurn } from '@ambrogio/conversations/application/exchange-turn';
import { createListConversations } from '@ambrogio/conversations/application/list-conversations';
import { createGetConversation } from '@ambrogio/conversations/application/get-conversation';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { registerSessionRoute } from '../adapters/in/session-route.adapter.js';

export type PreparedConversations = Awaited<ReturnType<typeof prepareConfiguredConversations>>;

/**
 * Prepare the configured archive and the conversation services from the validated configuration: the
 * archive is migrated, then the turns left pending are interrupted at `interruptedAt`.
 */
export async function prepareConfiguredConversations(config: ConversationConfig, interruptedAt: Date) {
  return openPreparedConversations(config.archivePath, interruptedAt, config);
}

async function openPreparedConversations(
  archiveFilename: string, interruptedAt: Date, config: ConversationConfig,
) {
  const archive = await openConversationArchive(archiveFilename);
  try {
    const turns = new SqliteTurnRepository(archive.db);
    const recoveredTurns = await createInterruptPendingTurns({ turns, clock: { now: () => interruptedAt } })();
    const read = new SqliteConversationListRead(archive.db, config.maxListPageSize);
    const listConversations = createListConversations(read, config.listPageSize, config.maxListPageSize);
    const failureMessage = config.language === 'it'
      ? 'Non riesco a completare la risposta.'
      : "I can't complete the response.";
    return { listConversations, maxListPageSize: config.maxListPageSize,
      failureMessage, language: config.language, archive, recoveredTurns, turns,
      conversations: new SqliteConversationLookup(archive.db),
      /** At shutdown, after the ingresses stop: interrupt the turns still pending. */
      interruptPendingTurns: createInterruptPendingTurns({ turns, clock: new SystemCurrentTime() }) };
  } catch (error) {
    try { await archive.close(); } catch { /* preserve the preparation failure */ }
    throw error;
  }
}

/** Supply the chosen reply producer to the conversational use case. */
export function assembleExchangeTurn(
  prepared: PreparedConversations,
  reply: ProduceConversationReply,
) {
  const clock = new SystemCurrentTime();
  return createExchangeTurn({
    begin: createBeginTurn({ turns: prepared.turns, conversations: prepared.conversations,
      identifiers: new UuidIdentifiers(), clock }),
    complete: createCompleteTurn({ turns: prepared.turns, clock }),
    history: new SqliteConversationHistoryRead(prepared.archive.db),
    reply,
    failureMessage: prepared.failureMessage,
    deadlines: new SystemDeadlines(),
  });
}

export const protocolSchemaPath = new URL('../../../../protocol/ambrogio-v1.schema.json', import.meta.url);

/** Read the published ambrogio.v1 schema once at startup. */
export async function loadProtocolSchema(path: URL | string = protocolSchemaPath): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new ProjectError('Invalid conversation protocol schema'); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProjectError('Invalid conversation protocol schema');
  }
  return value as Record<string, unknown>;
}

/** Attach the conversation session ingress to a server after archive recovery. */
export function registerConversationSessionRoute(
  server: FastifyInstance,
  prepared: PreparedConversations,
  reply: ProduceConversationReply,
  options: Readonly<{
    schema: Readonly<Record<string, unknown>>;
    allowedOrigins: readonly string[];
    pingIntervalMs: number;
    speech?: SpeechComponents;
  }>,
) {
  const sessions = createConversationSessions({
    exchange: assembleExchangeTurn(prepared, reply),
    decode: createProtocolDecoder(options.schema),
    language: prepared.language,
    pingIntervalMs: options.pingIntervalMs,
    log: server.log,
    ...(options.speech ? { speech: options.speech } : {}),
  });
  registerSessionRoute(server, sessions, options.allowedOrigins);
  return sessions;
}

/** Dependencies of the consultation routes, built once from the prepared component. */
function consultationDependencies(prepared: PreparedConversations) {
  return {
    listConversations: prepared.listConversations,
    getConversation: createGetConversation(new SqliteConversationHistoryRead(prepared.archive.db)),
    maxPageSize: prepared.maxListPageSize,
  };
}

/** The consultation routes of HTTP API `v1`, for the scope `/api/v1`. */
export function conversationApiRegistration(prepared: PreparedConversations): RouteRegistration {
  return conversationApiRoutes(consultationDependencies(prepared));
}

/** The same routes in the API without a version, for the scope `/api`, kept while a client release uses it. */
export function unversionedConversationRegistration(prepared: PreparedConversations): RouteRegistration {
  return unversionedConversationRoutes({ ...consultationDependencies(prepared), language: prepared.language });
}
