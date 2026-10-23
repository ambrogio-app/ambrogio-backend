import { randomUUID } from 'node:crypto';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { httpAjvOptions } from '@ambrogio/conversations/adapters/in/http/http-validation';
import type { VoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import type { SpeechComponents, SpeechComponentsFactory } from '@ambrogio/conversations/adapters/in/session/speech-components';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { loadProtocolSchema, prepareConfiguredConversations, registerConversationHistoryRoute,
  registerConversationListRoute, registerConversationSessionRoute } from '../composition/conversations.js';
import type { HttpConfig } from './http-config.js';
import { startupPhase } from './startup-failure.js';

type Prepared = Awaited<ReturnType<typeof prepareConfiguredConversations>>;
export type ConversationIngress = Readonly<{ stopAccepting(): Promise<void>; closeSessions(): Promise<void> }>;
export type ConversationServerOptions = Readonly<{ sessionPingIntervalMs?: number }>;
const defaultSessionPingIntervalMs = 30_000;

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown HTTP failure', { cause: value });
}

function serializeDiagnosticError(value: unknown): Readonly<{ type: string; message: string; stack: string }> {
  return value instanceof ProjectError
    ? { type: value.name, message: value.message, stack: value.stack ?? '' }
    : { type: 'Error', message: 'Unexpected HTTP failure', stack: '[redacted]' };
}

/** Build the HTTP server of the conversation ingress: session channel plus list and history routes. */
export async function buildConversationServer(config: HttpConfig, prepared: Prepared,
  replyProducer: ProduceConversationReply, voice?: VoiceConfig,
  speechFactory?: SpeechComponentsFactory, options: ConversationServerOptions = {}): Promise<Readonly<{
    server: FastifyInstance; turnIngress: ConversationIngress;
  }>> {
  const server = Fastify({
    ajv: { customOptions: httpAjvOptions },
    forceCloseConnections: true,
    logger: { level: 'warn', serializers: {
      err: serializeDiagnosticError,
    } },
    logController: new LogController({ disableRequestLogging: true,
      requestIdLogLabel: 'correlationId' }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });
  server.addHook('onRequest', (request, reply, done) => {
    reply.header('X-Request-Id', request.id);
    done();
  });
  server.setErrorHandler((error, request, reply) => {
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? error.statusCode : undefined;
    const status = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
      ? statusCode : 500;
    if (status === 500) request.log.error({ event: 'http.unexpected_failure', err: normalizeError(error) },
      'HTTP request failed');
    reply.code(status).send({ error: status === 500
      ? 'Internal server error.' : 'Invalid HTTP request.' });
  });
  try {
    await server.register(websocket);
    await server.register(helmet, { global: true, hsts: config.publicHttps
      ? { maxAge: config.hstsMaxAgeSeconds!, includeSubDomains: false, preload: false } : false });
    await server.register(cors, { origin: config.allowedOrigins.length ? [...config.allowedOrigins] : false,
      methods: ['GET'], exposedHeaders: ['X-Request-Id'] });
    registerConversationListRoute(server, prepared);
    registerConversationHistoryRoute(server, prepared);
    const schema = await loadProtocolSchema();
    let speech: SpeechComponents | undefined;
    if (voice) {
      const factory = speechFactory
        ?? (await import('@ambrogio/conversations/adapters/in/session/local-speech-components'))
          .createLocalSpeechComponents;
      const built = await startupPhase('Voice components could not be loaded', async () => factory(voice));
      speech = built;
      server.addHook('onClose', async () => { await built.close(); });
    }
    const turnIngress = registerConversationSessionRoute(server, prepared, replyProducer, {
      schema, allowedOrigins: config.allowedOrigins,
      pingIntervalMs: options.sessionPingIntervalMs ?? defaultSessionPingIntervalMs,
      ...(speech ? { speech } : {}),
    });
    return { server, turnIngress };
  } catch (error) {
    await server.close();
    throw error;
  }
}
