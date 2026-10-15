import { randomUUID } from 'node:crypto';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { loadConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import type { VoiceConfig } from '@ambrogio/conversations/adapters/out/voice-config';
import type { createVoiceComponents } from '@ambrogio/conversations/adapters/in/voice/voice-session';
import type { ProduceConversationReply } from '@ambrogio/conversations/application/produce-conversation-reply';
import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { prepareConfiguredConversations, registerConversationHistoryRoute,
  registerConversationListRoute, registerConversationTurnRoute } from '../composition/conversations.js';
import { conversationConfigPath } from './conversation-config-path.js';
import { httpConfigPath, loadHttpConfig, type HttpConfig } from './http-config.js';

type Prepared = Awaited<ReturnType<typeof prepareConfiguredConversations>>;

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown HTTP failure', { cause: value });
}

function serializeDiagnosticError(value: unknown): Readonly<{ type: string; message: string; stack: string }> {
  return value instanceof ProjectError
    ? { type: value.name, message: value.message, stack: value.stack ?? '' }
    : { type: 'Error', message: 'Unexpected HTTP failure', stack: '[redacted]' };
}

async function buildHttpServer(config: HttpConfig, prepared: Prepared,
  replyProducer?: ProduceConversationReply, voice?: VoiceConfig,
  voiceComponents?: typeof createVoiceComponents): Promise<Readonly<{
    server: FastifyInstance; turnIngress?: Readonly<{ stopAccepting(): Promise<void> }>;
  }>> {
  const server = Fastify({
    ...(replyProducer ? { forceCloseConnections: true } : {}),
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
    if (voice) await server.register(websocket);
    await server.register(helmet, { global: true, hsts: config.publicHttps
      ? { maxAge: config.hstsMaxAgeSeconds!, includeSubDomains: false, preload: false } : false });
    await server.register(cors, { origin: config.allowedOrigins.length ? [...config.allowedOrigins] : false,
      methods: replyProducer ? ['GET', 'POST'] : ['GET'], exposedHeaders: ['X-Request-Id'] });
    registerConversationListRoute(server, prepared);
    registerConversationHistoryRoute(server, prepared);
    const turnIngress = replyProducer
      ? registerConversationTurnRoute(server, prepared, replyProducer) : undefined;
    const voiceIngress = voice && replyProducer
      ? (await import('../composition/voice.js')).registerVoiceRoute(server, prepared, replyProducer,
        voice, voiceComponents)
      : undefined;
    const combined = turnIngress && voiceIngress
      ? { async stopAccepting() { await Promise.all([
        turnIngress.stopAccepting(), voiceIngress.stopAccepting(),
      ]); } } : turnIngress;
    return { server, ...(combined ? { turnIngress: combined } : {}) };
  } catch (error) {
    await server.close();
    throw error;
  }
}

export async function buildConsultationServer(config: HttpConfig, prepared: Prepared): Promise<FastifyInstance> {
  return (await buildHttpServer(config, prepared)).server;
}

export async function buildConversationServer(config: HttpConfig, prepared: Prepared,
  replyProducer: ProduceConversationReply, voice?: VoiceConfig,
  voiceComponents?: typeof createVoiceComponents) {
  const built = await buildHttpServer(config, prepared, replyProducer, voice, voiceComponents);
  return { server: built.server, turnIngress: built.turnIngress! };
}

export async function startConsultationServer(environment: NodeJS.ProcessEnv = process.env) {
  const [http, conversations] = await Promise.all([
    loadHttpConfig(httpConfigPath(environment)),
    loadConversationConfig(conversationConfigPath(environment)),
  ]);
  const prepared = await prepareConfiguredConversations(conversations, new Date());
  let server: FastifyInstance | undefined;
  try {
    server = await buildConsultationServer(http, prepared);
    await server.listen({ host: http.host, port: http.port });
  } catch (error) {
    try { if (server) await server.close(); } finally { await prepared.archive.close(); }
    throw error;
  }
  return { server, async close() {
    try { await server.close(); } finally { await prepared.archive.close(); }
  } };
}
