import { readFile } from 'node:fs/promises';

export type HttpConfig = Readonly<{
  host: string;
  port: number;
  allowedOrigins: readonly string[];
  publicHttps: boolean;
  hstsMaxAgeSeconds?: number;
}>;

export function httpConfigPath(environment: NodeJS.ProcessEnv = process.env): string {
  const filename = environment.AMBROGIO_HTTP_CONFIG_PATH;
  if (!filename?.trim()) throw new Error('Missing HTTP configuration path');
  return filename;
}

export async function loadHttpConfig(filename: string): Promise<HttpConfig> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(filename, 'utf8'));
  } catch {
    throw new Error('Invalid HTTP configuration file');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid HTTP configuration file');
  }
  const fields = value as Record<string, unknown>;
  if (typeof fields.host !== 'string' || !fields.host.trim()
    || typeof fields.port !== 'number' || !Number.isSafeInteger(fields.port)
    || fields.port < 1 || fields.port > 65535) {
    throw new Error('Invalid HTTP listener configuration');
  }
  const allowedOrigins = fields.allowedOrigins === undefined ? [] : fields.allowedOrigins;
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.every(origin => {
    if (typeof origin !== 'string' || origin === '*') return false;
    try {
      const parsed = new URL(origin);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === origin;
    } catch { return false; }
  })) {
    throw new Error('Invalid HTTP CORS origins');
  }
  const publicHttps = fields.publicHttps === undefined ? false : fields.publicHttps;
  if (typeof publicHttps !== 'boolean') throw new Error('Invalid public HTTPS configuration');
  const maxAge = fields.hstsMaxAgeSeconds;
  if ((maxAge !== undefined && (typeof maxAge !== 'number' || !Number.isSafeInteger(maxAge) || maxAge < 1))
    || (publicHttps && maxAge === undefined)) {
    throw new Error('Invalid HSTS duration');
  }
  return { host: fields.host, port: fields.port, allowedOrigins, publicHttps,
    ...(maxAge === undefined ? {} : { hstsMaxAgeSeconds: maxAge }) };
}
