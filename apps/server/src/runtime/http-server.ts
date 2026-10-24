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

export type HttpServerOptions = Readonly<{
  /** Base logger of the process; each failure is logged with a derived logger carrying the request identifier. */
  log: Logger;
  /** Registered in the order given, after the technical plugins. */
  routes: readonly HttpRouteRegistration[];
}>;

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
  const server = Fastify({
    ajv: { customOptions: httpAjvOptions },
    forceCloseConnections: true,
    logger: false,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });
  server.addHook('onRequest', (request, reply, done) => {
    reply.header('X-Request-Id', request.id);
    done();
  });
  server.setErrorHandler((error, request, reply) => {
    const problem = protocolProblem(error);
    if (problem) return sendProblem(reply, problem);
    options.log.child({ correlationId: request.id })
      .error({ event: 'http.unexpected_failure', err: normalizeError(error) }, 'HTTP request failed');
    return sendProblem(reply, internalServerError);
  });
  server.setNotFoundHandler((_request, reply) => sendProblem(reply, notFound));
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
