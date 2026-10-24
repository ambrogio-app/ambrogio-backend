import { ProjectError } from '@ambrogio/conversations/application/project-error';
import type { ConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import { SystemDeadlines } from '@ambrogio/conversations/adapters/out/system-deadlines';
import { UuidIdentifiers } from '@ambrogio/conversations/adapters/out/uuid-identifiers';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/sqlite/archive';
import { SqliteConversationHistoryRead } from '@ambrogio/conversations/adapters/out/sqlite/history-read';
import { SqliteConversationListRead } from '@ambrogio/conversations/adapters/out/sqlite/list-read';
import { SqliteConversationWrite } from '@ambrogio/conversations/adapters/out/sqlite/write';
import { createConversationSessions } from '@ambrogio/conversations/adapters/in/session/conversation-session';
import { createProtocolDecoder } from '@ambrogio/conversations/adapters/in/session/protocol-decoder';
import type { SpeechComponents } from '@ambrogio/conversations/adapters/in/session/speech-components';
import { registerHistoryRoute } from '@ambrogio/conversations/adapters/in/http/history-route';
import { registerListRoute } from '@ambrogio/conversations/adapters/in/http/list-route';
import { createBeginTurn } from '@ambrogio/conversations/application/begin-turn';
import { createCompleteTurn } from '@ambrogio/conversations/application/complete-turn';
import { createExchangeTurn } from '@ambrogio/conversations/application/exchange-turn';
import { createListConversations } from '@ambrogio/conversations/application/list-conversations';
import { createGetConversation } from '@ambrogio/conversations/application/get-conversation';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { registerSessionRoute } from '../adapters/in/session-route.adapter.js';

export type PreparedConversations = Awaited<ReturnType<typeof prepareConfiguredConversations>>;

/** Prepare the configured archive and the conversation services from the validated configuration. */
export async function prepareConfiguredConversations(config: ConversationConfig, interruptedAt: Date) {
  return openPreparedConversations(config.archivePath, interruptedAt, config);
}

async function openPreparedConversations(
  archiveFilename: string, interruptedAt: Date, config: ConversationConfig,
) {
  const archive = await openConversationArchive(archiveFilename, interruptedAt);
  try {
    const read = new SqliteConversationListRead(archive.db, config.maxListPageSize);
    const listConversations = createListConversations(read, config.listPageSize, config.maxListPageSize);
    const failureMessage = config.language === 'it'
      ? 'Non riesco a completare la risposta.'
      : "I can't complete the response.";
    return { listConversations, maxListPageSize: config.maxListPageSize,
      failureMessage, language: config.language, archive,
      write: new SqliteConversationWrite(archive.db) };
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
    begin: createBeginTurn({ archive: prepared.write, identifiers: new UuidIdentifiers(), clock }),
    complete: createCompleteTurn({ archive: prepared.write, clock }),
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

/** Attach the HTTP history ingress after archive recovery. */
export function registerConversationHistoryRoute(
  server: FastifyInstance,
  prepared: PreparedConversations,
): void {
  registerHistoryRoute(server, {
    getConversation: createGetConversation(new SqliteConversationHistoryRead(prepared.archive.db)),
    language: prepared.language,
  });
}

/** Attach the HTTP list ingress after archive recovery. */
export function registerConversationListRoute(
  server: FastifyInstance,
  prepared: PreparedConversations,
): void {
  registerListRoute(server, {
    listConversations: prepared.listConversations,
    maxPageSize: prepared.maxListPageSize,
    language: prepared.language,
  });
}
