import { loadConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import type { ConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import { UuidIdentifiers } from '@ambrogio/conversations/adapters/out/uuid-identifiers';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/sqlite/archive';
import { SqliteConversationHistoryRead } from '@ambrogio/conversations/adapters/out/sqlite/history-read';
import { SqliteConversationListRead } from '@ambrogio/conversations/adapters/out/sqlite/list-read';
import { SqliteConversationWrite } from '@ambrogio/conversations/adapters/out/sqlite/write';
import { registerTurnRoute } from '@ambrogio/conversations/adapters/in/http/turn-route';
import { registerHistoryRoute } from '@ambrogio/conversations/adapters/in/http/history-route';
import { registerListRoute } from '@ambrogio/conversations/adapters/in/http/list-route';
import { createBeginTurn } from '@ambrogio/conversations/application/begin-turn';
import { createCompleteTurn } from '@ambrogio/conversations/application/complete-turn';
import { createExchangeTurn } from '@ambrogio/conversations/application/exchange-turn';
import { createListConversations } from '@ambrogio/conversations/application/list-conversations';
import { createGetConversation } from '@ambrogio/conversations/application/get-conversation';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { FastifyInstance } from 'fastify';
import { conversationConfigPath } from '../runtime/conversation-config-path.js';

/** Prepare conversation resources before an HTTP ingress can be enabled. */
export async function prepareConversations(
  archiveFilename: string,
  interruptedAt: Date,
  environment?: NodeJS.ProcessEnv,
) {
  const config = await loadConversationConfig(conversationConfigPath(environment));
  return openPreparedConversations(archiveFilename, interruptedAt, config);
}

/** Prepare the configured archive without reading the component JSON again. */
export async function prepareConfiguredConversations(config: ConversationConfig, interruptedAt: Date) {
  if (!config.archivePath?.trim()) throw new Error('Missing conversation archive path');
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
      failureMessage, language: config.language, archive };
  } catch (error) {
    try { await archive.close(); } catch { /* preserve the preparation failure */ }
    throw error;
  }
}

/** Supply the chosen reply producer to the conversational use case. */
export function assembleExchangeTurn(
  prepared: Awaited<ReturnType<typeof prepareConversations>>,
  reply: ProduceConversationReply,
) {
  const write = new SqliteConversationWrite(prepared.archive.db);
  const clock = new SystemCurrentTime();
  return createExchangeTurn({
    begin: createBeginTurn({ archive: write, identifiers: new UuidIdentifiers(), clock }),
    complete: createCompleteTurn({ archive: write, clock }),
    history: new SqliteConversationHistoryRead(prepared.archive.db),
    reply,
    failureMessage: prepared.failureMessage,
  });
}

/** Attach the HTTP turn ingress to a server after archive recovery. */
export function registerConversationTurnRoute(
  server: FastifyInstance,
  prepared: Awaited<ReturnType<typeof prepareConversations>>,
  reply: ProduceConversationReply,
): Readonly<{ stopAccepting(): Promise<void> }> {
  return registerTurnRoute(server, { exchange: assembleExchangeTurn(prepared, reply),
    language: prepared.language });
}

/** Attach the HTTP history ingress after archive recovery. */
export function registerConversationHistoryRoute(
  server: FastifyInstance,
  prepared: Awaited<ReturnType<typeof prepareConversations>>,
): void {
  registerHistoryRoute(server, {
    getConversation: createGetConversation(new SqliteConversationHistoryRead(prepared.archive.db)),
    language: prepared.language,
  });
}

/** Attach the HTTP list ingress after archive recovery. */
export function registerConversationListRoute(
  server: FastifyInstance,
  prepared: Awaited<ReturnType<typeof prepareConversations>>,
): void {
  registerListRoute(server, {
    listConversations: prepared.listConversations,
    maxPageSize: prepared.maxListPageSize,
    language: prepared.language,
  });
}
