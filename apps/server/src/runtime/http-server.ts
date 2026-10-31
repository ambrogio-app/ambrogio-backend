import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import type { HttpConfig } from './http-config.js';
import type { Logger } from './logger.js';

/**
 * One registration delivered by the composition root: it registers its routes in its own Fastify scope, under
 * `prefix` when given, with dependencies already built.
 */
export type HttpRouteRegistration = Readonly<{
  prefix?: string;
  register: (scope: FastifyInstance) => void;
}>;

/**
 * The shutdown state of one HTTP server: once begun, the liveness endpoint answers `503` and every response carries
 * `Connection: close` («Profilo dell'endpoint di liveness», «Ciclo di vita dei processi di servizio con Node.js»).
 */
export type HttpShutdown = Readonly<{
  begin(): void;
  readonly started: boolean;
}>;

export function createHttpShutdown(): HttpShutdown {
  let started = false;
  return { begin() { started = true; }, get started() { return started; } };
}

export type HttpServerOptions = Readonly<{
  /** Base logger of the process; each failure is logged with a derived logger carrying the request identifier. */
  log: Logger;
  /** Registered in the order given, after the technical plugins. */
  routes: readonly HttpRouteRegistration[];
  /** Begun by the owner of the server when its orderly shutdown starts. */
  shutdown: HttpShutdown;
}>;

/** The explicit global limit of received bodies («Profilo del limite dei corpi HTTP»). */
export const HTTP_BODY_LIMIT_BYTES = 1_048_576;

/** The liveness endpoint, outside `/api` («Profilo dell'endpoint di liveness»). */
export const healthRoute = '/health';

/** Keep Fastify's schema validator from changing received request values. */
export const httpAjvOptions = {
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  allErrors: false,
} as const;

type Problem = Readonly<{ type: string; title: string; status: number; detail?: string;
  errors?: readonly ValidationProblem[] }>;
type ValidationProblem = Readonly<{ location: 'body' | 'query' | 'path' | 'header'; pointer: string;
  code: 'unknown-field' | 'invalid-value'; detail: string }>;

// The protocol problem catalog («Catalogo dei problemi di protocollo HTTP»).
const badRequest: Problem = { type: 'about:blank', title: 'Bad Request', status: 400 };
const notFound: Problem = { type: 'about:blank', title: 'Not Found', status: 404 };
const contentTooLarge: Problem = { type: 'about:blank', title: 'Content Too Large', status: 413 };
const unsupportedMediaType: Problem = { type: 'about:blank', title: 'Unsupported Media Type', status: 415 };
const malformedJson: Problem = { type: '/problems/malformed-json', title: 'Malformed JSON', status: 400,
  detail: 'The request body is not valid JSON.' };
const internalServerError: Problem = { type: 'about:blank', title: 'Internal Server Error', status: 500 };

const locations: Readonly<Record<string, ValidationProblem['location']>> = {
  body: 'body', querystring: 'query', params: 'path', headers: 'header',
};

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

const pointerToken = (name: string) => `/${name.replaceAll('~', '~0').replaceAll('/', '~1')}`;

/** One violation as public members only: no validator keyword, schema path, parameter, message or value. */
function violation(location: ValidationProblem['location'], value: unknown): ValidationProblem {
  const entry = record(value);
  const path = typeof entry?.instancePath === 'string' ? entry.instancePath : '';
  const params = record(entry?.params);
  if (entry?.keyword === 'additionalProperties' && typeof params?.additionalProperty === 'string') {
    return { location, pointer: path + pointerToken(params.additionalProperty), code: 'unknown-field',
      detail: 'The field is not allowed.' };
  }
  const missing = entry?.keyword === 'required' && typeof params?.missingProperty === 'string'
    ? pointerToken(params.missingProperty) : '';
  return { location, pointer: path + missing, code: 'invalid-value', detail: 'The value is not valid.' };
}

/** The catalog problem of a protocol error detected before the use case, if the catalog maps it. */
function protocolProblem(error: unknown): Problem | undefined {
  const fields = record(error);
  if (!fields) return undefined;
  if (Array.isArray(fields.validation) && fields.validation.length > 0) {
    const location = typeof fields.validationContext === 'string' ? locations[fields.validationContext] : undefined;
    if (!location) return undefined;
    return { type: '/problems/request-validation', title: 'Request validation failed', status: 400,
      errors: fields.validation.map(entry => violation(location, entry)) };
  }
  switch (fields.code) {
    case 'FST_ERR_CTP_INVALID_JSON_BODY':
    case 'FST_ERR_CTP_EMPTY_JSON_BODY': return malformedJson;
    case 'FST_ERR_CTP_BODY_TOO_LARGE': return contentTooLarge;
    case 'FST_ERR_CTP_INVALID_MEDIA_TYPE': return unsupportedMediaType;
    default: return undefined;
  }
}

/** Send a problem as a new object of its members, never cached («Forma dei Problem Details dell'API HTTP»). */
function sendProblem(reply: FastifyReply, problem: Problem): FastifyReply {
  const body: Record<string, unknown> = { type: problem.type, title: problem.title, status: problem.status };
  if (problem.detail !== undefined) body.detail = problem.detail;
  if (problem.errors !== undefined) body.errors = problem.errors.map(entry => ({ location: entry.location,
    pointer: entry.pointer, code: entry.code, detail: entry.detail }));
  return reply.code(problem.status).header('Cache-Control', 'no-store').type('application/problem+json').send(body);
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown HTTP failure', { cause: value });
}

/**
 * Technical factory of the HTTP server: request identifiers, security headers, CORS, WebSocket support, validation
 * options and the central handling of errors and unknown routes. It knows no business module: the composition root
 * hands it the route registrations, already built, and the base logger. Fastify's own logger stays disabled, so
 * nothing is logged automatically for requests and responses («Assenza dei log HTTP automatici»).
 */
export async function createHttpServer(config: HttpConfig, options: HttpServerOptions): Promise<FastifyInstance> {
  const unexpectedFailure = (error: unknown, requestId: string, reply: FastifyReply) => {
    options.log.child({ correlationId: requestId })
      .error({ event: 'http.unexpected_failure', err: normalizeError(error) }, 'HTTP request failed');
    return sendProblem(reply, internalServerError);
  };
  const server = Fastify({
    ajv: { customOptions: httpAjvOptions },
    bodyLimit: HTTP_BODY_LIMIT_BYTES,
    // A request target that is not a valid URL and a path parameter longer than the router accepts are catalog
    // problems; other routing errors are unexpected failures.
    frameworkErrors: (error, request, reply) => {
      reply.header('X-Request-Id', request.id);
      const code = record(error)?.code;
      if (code === 'FST_ERR_BAD_URL') return sendProblem(reply, badRequest);
      if (code === 'FST_ERR_MAX_PARAM_LENGTH') return sendProblem(reply, notFound);
      return unexpectedFailure(error, request.id, reply);
    },
    forceCloseConnections: true,
    logger: false,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });
  server.addHook('onRequest', (request, reply, done) => {
    reply.header('X-Request-Id', request.id);
    done();
  });
  // From the start of the shutdown a keep-alive connection closes after its last response.
  server.addHook('onSend', (_request, reply, payload, done) => {
    if (options.shutdown.started) reply.header('Connection', 'close');
    done(null, payload);
  });
  server.setErrorHandler((error, request, reply) => {
    const problem = protocolProblem(error);
    if (problem) return sendProblem(reply, problem);
    return unexpectedFailure(error, request.id, reply);
  });
  server.setNotFoundHandler((_request, reply) => sendProblem(reply, notFound));
  // Liveness only: it reads no external resource and reveals nothing about the system.
  server.get(healthRoute, (_request, reply) => {
    reply.code(options.shutdown.started ? 503 : 200).header('Cache-Control', 'no-store').send();
  });
  try {
    await server.register(websocket);
    await server.register(helmet, { global: true, hsts: config.publicHttps
      ? { maxAge: config.hstsMaxAgeSeconds!, includeSubDomains: false, preload: false } : false });
    await server.register(cors, { origin: config.allowedOrigins.length ? [...config.allowedOrigins] : false,
      methods: ['GET'], exposedHeaders: ['X-Request-Id'] });
    for (const route of options.routes) {
      await server.register(async scope => { route.register(scope); },
        route.prefix === undefined ? {} : { prefix: route.prefix });
    }
    return server;
  } catch (error) {
    await server.close();
    throw error;
  }
}
