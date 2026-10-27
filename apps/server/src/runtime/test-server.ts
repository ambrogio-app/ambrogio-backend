import { tmpdir } from 'node:os';
import type { SpeechComponentsFactory } from '@ambrogio/conversations/adapters/in/session/speech-components';
import { readConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import { createTemporaryDatabase } from '@ambrogio/conversations/adapters/out/postgres/temporary-database';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import { prepareConfiguredConversations } from '../composition/conversations.js';
import { buildConversationServer } from '../composition/http-surface.js';
import { createResourceStack, startupWithCleanup } from './lifecycle.js';
import { archiveConnectionFault } from './conversation-server.js';
import { createBaseLogger } from './logger.js';

/** What a client integration test supplies to the test server. */
export type TestServerOptions = Readonly<{
  /**
   * URL of a PostgreSQL test server whose role may create and drop databases, usually the value of
   * `AMBROGIO_TEST_DATABASE_URL`: the archive is a new database there, dropped when the server closes.
   */
  databaseUrl: string;
  language: 'en' | 'it';
  /** Deterministic replacement of the orchestrator. */
  reply: ProduceConversationReply;
  /** Deterministic speech recognition and synthesis; voice turns are accepted only when present. */
  speech?: SpeechComponentsFactory;
  /** Browser origins allowed by the HTTP component, as an installation would configure them. */
  allowedOrigins?: readonly string[];
  sessionPingIntervalMs?: number;
}>;

export type TestServer = Readonly<{
  /** HTTP origin of the server, for example `http://127.0.0.1:43123`. */
  origin: string;
  /** URL of the `ambrogio.v1` session. */
  sessionUrl: URL;
  /** Stop accepting turns, interrupt the pending ones, close sessions, listener and archive, drop the database. */
  close(): Promise<void>;
}>;

/**
 * Public test entry point: the conversational server of the product, with its protocol, HTTP routes
 * and archive, listening on a free loopback port, with the orchestrator and the speech components
 * replaced by the deterministic ones of the caller. Client integration tests use only this module.
 */
export async function startTestServer(options: TestServerOptions): Promise<TestServer> {
  // One base logger for the test server, as the entry point of a process creates it.
  const log = createBaseLogger();
  const resources = createResourceStack('Test server shutdown failed');
  try {
    const database = await createTemporaryDatabase(options.databaseUrl);
    resources.defer('Test database could not be dropped', () => database.drop());
    // The configuration module applies its own defaults to an environment built here, never the process one.
    const prepared = await prepareConfiguredConversations(readConversationConfig({
      AMBROGIO_DATABASE_URL: database.url, AMBROGIO_LANGUAGE: options.language,
    }, 'test'), new Date(), archiveConnectionFault(log));
    resources.defer('Conversation archive could not be closed', () => prepared.archive.close());
    // Built without listening; the deterministic speech components ignore the model paths of the voice configuration.
    const { server, turnIngress } = await buildConversationServer({ host: '127.0.0.1', port: 0,
      allowedOrigins: options.allowedOrigins ?? [], publicHttps: false }, prepared, options.reply,
    options.speech ? { sttModelDir: tmpdir(), voiceModelDir: tmpdir() } : undefined, options.speech, { log, resources,
      ...(options.sessionPingIntervalMs === undefined ? {} : { sessionPingIntervalMs: options.sessionPingIntervalMs }) });
    // This module is the entry point of the test server: it activates the listener itself.
    const origin = await server.listen({ host: '127.0.0.1', port: 0 });
    let closing: Promise<void> | undefined;
    return { origin, sessionUrl: new URL('api/session', `${origin.replace('http:', 'ws:')}/`), close() {
      closing ??= (async () => {
        try {
          await turnIngress.stopAccepting();
          await prepared.interruptPendingTurns();
          await turnIngress.closeSessions();
        } finally { await resources.close(); }
      })();
      return closing;
    } };
  } catch (error) {
    const cleanup = await resources.close().then(() => [], () => resources.faults);
    throw startupWithCleanup('Test server startup failed', error, cleanup);
  }
}
