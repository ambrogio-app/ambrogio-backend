import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

/**
 * The credentials named by the agent files the tests write. A literal `apiKey`, `token` or
 * `clientSecret` string in a test fixture becomes a reference (`apiKeyEnv`, `tokenEnv`,
 * `clientSecretEnv`) to a variable of this environment that holds the same value, so the fixtures keep
 * their readable secrets while the files contain none.
 */
export const agentSecrets: Record<string, string> = {};

const secretFields = ['apiKey', 'token', 'clientSecret'] as const;

function variableFor(field: string, value: string): string {
  const digest = createHash('sha256').update(`${field}:${value}`).digest('hex').slice(0, 12).toUpperCase();
  return `TEST_${field.toUpperCase()}_${digest}`;
}

function withSecretReferences(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withSecretReferences);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => {
    if ((secretFields as readonly string[]).includes(key) && typeof inner === 'string') {
      const name = variableFor(key, inner);
      agentSecrets[name] = inner;
      return [`${key}Env`, name];
    }
    return [key, withSecretReferences(inner)];
  }));
}

/**
 * Write an agent JSON file. `content` is JSON text; text that is not JSON is written unchanged, to
 * exercise an unreadable file. Literal secrets are moved to `agentSecrets`.
 */
export async function writeAgentFile(filename: string, content: string): Promise<void> {
  let value: unknown;
  try { value = JSON.parse(content); }
  catch { await writeFile(filename, content); return; }
  await writeFile(filename, `${JSON.stringify(withSecretReferences(value), null, 2)}\n`);
}

/** The environment of a test process with the given variables and the agent credentials. */
export function testEnvironment(variables: Readonly<Record<string, string | undefined>> = {}): NodeJS.ProcessEnv {
  return { AMBROGIO_ENV: 'test', ...agentSecrets, ...variables };
}

/**
 * The variables of the HTTP and Conversazioni components for a server on the loopback interface, with the
 * archive in the PostgreSQL test database `files.database`.
 */
export function serverEnvironment(files: Readonly<{ directory: string; database: string }>, port: number,
  agentDirectory: string = files.directory, variables: Readonly<Record<string, string | undefined>> = {}): NodeJS.ProcessEnv {
  return testEnvironment({ AMBROGIO_HTTP_HOST: '127.0.0.1', AMBROGIO_HTTP_PORT: String(port),
    AMBROGIO_PUBLIC_HTTPS: 'false', AMBROGIO_DATABASE_URL: files.database, AMBROGIO_AGENTS_DIR: agentDirectory,
    ...variables });
}
