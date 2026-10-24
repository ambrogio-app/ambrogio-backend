import Fastify, { type FastifyInstance } from 'fastify';

/** The Ajv options the server's HTTP factory applies: validation never changes the received values. */
const ajvOptions = { coerceTypes: false, useDefaults: false, removeAdditional: false, allErrors: false } as const;

/** A Fastify instance with the given route registration in a scope under `prefix`, as the application does. */
export function routeServer(prefix: string, register: (scope: FastifyInstance) => void): FastifyInstance {
  const server = Fastify({ ajv: { customOptions: ajvOptions } });
  void server.register(async scope => { register(scope); }, { prefix });
  return server;
}
