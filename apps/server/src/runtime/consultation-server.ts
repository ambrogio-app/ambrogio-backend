import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { loadConversationConfig } from '@ambrogio/conversations/adapters/out/conversation-config';
import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { prepareConfiguredConversations, registerConversationHistoryRoute,
  registerConversationListRoute } from '../composition/conversations.js';
import { conversationConfigPath } from './conversation-config-path.js';
import { httpConfigPath, loadHttpConfig, type HttpConfig } from './http-config.js';

type Prepared = Awaited<ReturnType<typeof prepareConfiguredConversations>>;

export async function buildConsultationServer(config: HttpConfig, prepared: Prepared): Promise<FastifyInstance> {
  const server = Fastify({
    logger: { level: 'warn', serializers: {
      err: () => ({ type: 'Error', message: 'Unexpected HTTP failure', stack: '[redacted]' }),
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
    if (status === 500) request.log.error({ event: 'http.unexpected_failure', err: error });
    reply.code(status).send({ error: status === 500
      ? 'Internal server error.' : 'Invalid HTTP request.' });
  });
  try {
    await server.register(helmet, { global: true, hsts: config.publicHttps
      ? { maxAge: config.hstsMaxAgeSeconds!, includeSubDomains: false, preload: false } : false });
    await server.register(cors, { origin: config.allowedOrigins.length ? [...config.allowedOrigins] : false,
      methods: ['GET'], exposedHeaders: ['X-Request-Id'] });
    registerConversationListRoute(server, prepared);
    registerConversationHistoryRoute(server, prepared);
    return server;
  } catch (error) {
    await server.close();
    throw error;
  }
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
