import type { ConversationSessions } from '@ambrogio/conversations/adapters/in/session/conversation-session';
import type { SpeechComponents, SpeechComponentsFactory } from '@ambrogio/conversations/adapters/in/session/speech-components';
import type { VoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { FastifyInstance } from 'fastify';
import { createHttpServer, type HttpRouteRegistration } from '../runtime/http-server.js';
import type { HttpConfig } from '../runtime/http-config.js';
import type { ResourceStack } from '../runtime/lifecycle.js';
import type { Logger } from '../runtime/logger.js';
import { startupPhase } from '../runtime/startup-failure.js';
import { conversationApiRegistration, loadProtocolSchema, registerConversationSessionRoute,
  unversionedConversationRegistration, type PreparedConversations } from './conversations.js';

export type ConversationIngress = Readonly<{ stopAccepting(): Promise<void>; closeSessions(): Promise<void> }>;
export type ConversationServerOptions = Readonly<{
  /** Base logger of the process, shared with every component of the surface. */
  log: Logger;
  /** Closing stack of the composition root: the surface registers its resources right after acquiring them. */
  resources: ResourceStack;
  sessionPingIntervalMs?: number;
}>;
const defaultSessionPingIntervalMs = 30_000;

/**
 * The HTTP surface of the conversation server, assembled by hand: the protocol schema and the speech components
 * are built first, then the registrations of the session channel, of HTTP API `v1` under `/api/v1` and of the API
 * without a version under `/api` are handed, already built, to the technical HTTP factory. The server is built
 * without listening; speech components and server are closed by the caller's stack, server first.
 */
export async function buildConversationServer(config: HttpConfig, prepared: PreparedConversations,
  replyProducer: ProduceConversationReply, voice: VoiceConfig | undefined,
  speechFactory: SpeechComponentsFactory | undefined, options: ConversationServerOptions): Promise<Readonly<{
    server: FastifyInstance; turnIngress: ConversationIngress;
  }>> {
  const schema = await loadProtocolSchema();
  let speech: SpeechComponents | undefined;
  if (voice) {
    const factory = speechFactory
      ?? (await import('@ambrogio/conversations/adapters/in/session/local-speech-components'))
        .createLocalSpeechComponents;
    const loaded = await startupPhase('Voice components could not be loaded', async () => factory(voice));
    options.resources.defer('Voice components could not be closed', () => loaded.close());
    speech = loaded;
  }
  let sessions: ConversationSessions | undefined;
  const session: HttpRouteRegistration = { register(scope) {
    sessions = registerConversationSessionRoute(scope, prepared, replyProducer, {
      schema, allowedOrigins: config.allowedOrigins, log: options.log,
      pingIntervalMs: options.sessionPingIntervalMs ?? defaultSessionPingIntervalMs,
      ...(speech ? { speech } : {}),
    });
  } };
  const server = await createHttpServer(config, { log: options.log, routes: [
    { prefix: '/api/v1', register: conversationApiRegistration(prepared) },
    { prefix: '/api', register: unversionedConversationRegistration(prepared, options.log) },
    session,
  ] });
  options.resources.defer('HTTP server could not be closed', () => server.close());
  const registered = sessions!;
  return { server, turnIngress: {
    stopAccepting: () => registered.stopAccepting(),
    closeSessions: () => registered.closeSessions(),
  } };
}
