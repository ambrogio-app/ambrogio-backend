import { join } from 'node:path';
import type { SpeechComponentsFactory } from '@ambrogio/conversations/adapters/in/session/speech-components';
import { readConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import { prepareConfiguredConversations } from '../composition/conversations.js';
import { buildConversationServer } from './http-server.js';

/** What a client integration test supplies to the test server. */
export type TestServerOptions = Readonly<{
  /** Folder where the server keeps its conversation archive; the caller owns and removes it. */
  directory: string;
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
  /** Stop accepting turns, interrupt the pending ones and close sessions, listener and archive. */
  close(): Promise<void>;
}>;

/**
 * Public test entry point: the conversational server of the product, with its protocol, HTTP routes
 * and archive, listening on a free loopback port, with the orchestrator and the speech components
 * replaced by the deterministic ones of the caller. Client integration tests use only this module.
 */
export async function startTestServer(options: TestServerOptions): Promise<TestServer> {
  // The configuration module applies its own defaults to an environment built here, never the process one.
  const prepared = await prepareConfiguredConversations(readConversationConfig({
    AMBROGIO_ARCHIVE_PATH: join(options.directory, 'conversations.sqlite'), AMBROGIO_LANGUAGE: options.language,
  }, 'test'), new Date());
  let built: Awaited<ReturnType<typeof buildConversationServer>> | undefined;
  try {
    built = await buildConversationServer({ host: '127.0.0.1', port: 0,
      allowedOrigins: options.allowedOrigins ?? [], publicHttps: false }, prepared, options.reply,
    // The deterministic speech components ignore the model paths of the voice configuration.
    options.speech ? { voskModelPath: options.directory, voiceEngine: 'piper', voiceModelDir: options.directory }
      : undefined, options.speech,
    options.sessionPingIntervalMs === undefined ? {} : { sessionPingIntervalMs: options.sessionPingIntervalMs });
    const origin = await built.server.listen({ host: '127.0.0.1', port: 0 });
    const { server, turnIngress } = built;
    let closing: Promise<void> | undefined;
    return { origin, sessionUrl: new URL('api/session', `${origin.replace('http:', 'ws:')}/`), close() {
      closing ??= (async () => {
        try {
          await turnIngress.stopAccepting();
          await prepared.interruptPendingTurns();
          await turnIngress.closeSessions();
        } finally {
          try { await server.close(); }
          finally { await prepared.archive.close(); }
        }
      })();
      return closing;
    } };
  } catch (error) {
    try { if (built) await built.server.close(); }
    finally { await prepared.archive.close(); }
    throw error;
  }
}
