import { ProjectError } from '@ambrogio/conversations/application/project-error';
import type { ConversationSessions } from '@ambrogio/conversations/adapters/in/session/conversation-session';
import type { SpeechComponents, SpeechComponentsFactory } from '@ambrogio/conversations/adapters/in/session/speech-components';
import type { VoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import type { FastifyInstance } from 'fastify';
import { createHttpServer, type HttpRouteRegistration } from '../runtime/http-server.js';
import type { HttpConfig } from '../runtime/http-config.js';
import { startupPhase } from '../runtime/startup-failure.js';
import { conversationApiRegistration, loadProtocolSchema, registerConversationSessionRoute,
  unversionedConversationRegistration, type PreparedConversations } from './conversations.js';

export type ConversationIngress = Readonly<{ stopAccepting(): Promise<void>; closeSessions(): Promise<void> }>;
export type ConversationServerOptions = Readonly<{ sessionPingIntervalMs?: number }>;
const defaultSessionPingIntervalMs = 30_000;

/** The controlled `err` view: project errors are ours, anything else stays opaque. */
function serializeDiagnosticError(value: unknown): Readonly<{ type: string; message: string; stack: string }> {
  return value instanceof ProjectError
    ? { type: value.name, message: value.message, stack: value.stack ?? '' }
    : { type: 'Error', message: 'Unexpected HTTP failure', stack: '[redacted]' };
}

/**
 * The HTTP surface of the conversation server, assembled by hand: the protocol schema and the speech components
 * are built first, then the registrations of the session channel, of HTTP API `v1` under `/api/v1` and of the API
 * without a version under `/api` are handed, already built, to the technical HTTP factory.
 */
export async function buildConversationServer(config: HttpConfig, prepared: PreparedConversations,
  replyProducer: ProduceConversationReply, voice?: VoiceConfig,
  speechFactory?: SpeechComponentsFactory, options: ConversationServerOptions = {}): Promise<Readonly<{
    server: FastifyInstance; turnIngress: ConversationIngress;
  }>> {
  const schema = await loadProtocolSchema();
  let speech: SpeechComponents | undefined;
  if (voice) {
    const factory = speechFactory
      ?? (await import('@ambrogio/conversations/adapters/in/session/local-speech-components'))
        .createLocalSpeechComponents;
    speech = await startupPhase('Voice components could not be loaded', async () => factory(voice));
  }
  let closingSpeech: Promise<void> | undefined;
  const closeSpeech = () => { closingSpeech ??= speech ? speech.close() : Promise.resolve(); return closingSpeech; };
  let sessions: ConversationSessions | undefined;
  const session: HttpRouteRegistration = { register(scope) {
    sessions = registerConversationSessionRoute(scope, prepared, replyProducer, {
      schema, allowedOrigins: config.allowedOrigins,
      pingIntervalMs: options.sessionPingIntervalMs ?? defaultSessionPingIntervalMs,
      ...(speech ? { speech } : {}),
    });
    scope.addHook('onClose', async () => { await closeSpeech(); });
  } };
  let server: FastifyInstance;
  try {
    server = await createHttpServer(config, { serializeError: serializeDiagnosticError, routes: [
      { prefix: '/api/v1', register: conversationApiRegistration(prepared) },
      { prefix: '/api', register: unversionedConversationRegistration(prepared) },
      session,
    ] });
  } catch (error) {
    await closeSpeech();
    throw error;
  }
  const registered = sessions!;
  return { server, turnIngress: {
    stopAccepting: () => registered.stopAccepting(),
    closeSessions: () => registered.closeSessions(),
  } };
}
