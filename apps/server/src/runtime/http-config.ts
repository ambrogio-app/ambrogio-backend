import { integerVariable, invalidVariable, readVariable, requireVariable, type EnvironmentVariable,
  type RuntimeEnvironment } from '@ambrogio/conversations/adapters/out/environment-variables';

export type HttpConfig = Readonly<{
  host: string;
  port: number;
  allowedOrigins: readonly string[];
  publicHttps: boolean;
  hstsMaxAgeSeconds?: number;
}>;

/** The variables of the HTTP component; this module alone owns their defaults. */
export const httpVariables = {
  host: { name: 'AMBROGIO_HTTP_HOST', default: { environments: 'development', value: '127.0.0.1' } },
  port: { name: 'AMBROGIO_HTTP_PORT', default: { environments: 'development', value: '3000' } },
  publicHttps: { name: 'AMBROGIO_PUBLIC_HTTPS', default: { environments: 'development', value: 'false' } },
  hstsMaxAgeSeconds: { name: 'AMBROGIO_HSTS_MAX_AGE_SECONDS' },
  allowedOrigins: { name: 'AMBROGIO_ALLOWED_ORIGINS' },
} as const satisfies Record<string, EnvironmentVariable>;

function exactOrigin(origin: string): boolean {
  if (origin === '*') return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === origin;
  } catch { return false; }
}

/** Read and validate the HTTP component's configuration before the listener is created. */
export function readHttpConfig(environment: NodeJS.ProcessEnv, runtime: RuntimeEnvironment): HttpConfig {
  const variables = httpVariables;
  const host = requireVariable(environment, runtime, variables.host);
  if (!host.trim()) throw invalidVariable(variables.host.name, 'expected a host address');
  const port = integerVariable(variables.port.name, requireVariable(environment, runtime, variables.port), 1, 65535);
  const listed = readVariable(environment, runtime, variables.allowedOrigins);
  // No list authorizes no origin.
  const allowedOrigins = listed === undefined ? [] : listed.split(',').map(origin => origin.trim());
  if (!allowedOrigins.every(exactOrigin)) {
    throw invalidVariable(variables.allowedOrigins.name, 'expected comma-separated exact HTTP or HTTPS origins');
  }
  const https = requireVariable(environment, runtime, variables.publicHttps);
  if (https !== 'true' && https !== 'false') throw invalidVariable(variables.publicHttps.name, 'expected true or false');
  const publicHttps = https === 'true';
  const maxAge = readVariable(environment, runtime, variables.hstsMaxAgeSeconds);
  if (publicHttps && maxAge === undefined) {
    throw invalidVariable(variables.hstsMaxAgeSeconds.name, 'required when AMBROGIO_PUBLIC_HTTPS is true');
  }
  return { host, port, allowedOrigins, publicHttps,
    ...(maxAge === undefined ? {} : {
      hstsMaxAgeSeconds: integerVariable(variables.hstsMaxAgeSeconds.name, maxAge, 1) }) };
}
