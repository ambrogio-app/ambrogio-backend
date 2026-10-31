import { integerVariable, invalidVariable, requireVariable,
  type EnvironmentVariable, type RuntimeEnvironment } from './environment-variables.js';

export type ConversationConfig = Readonly<{
  listPageSize: number;
  maxListPageSize: number;
  /** How many of the latest turns of a conversation the models receive. */
  historyTurns: number;
  language: 'en' | 'it';
  /** IANA name of the family's time zone. */
  timeZone: string;
  /** URL of the PostgreSQL database of the archive; never logged nor reported. */
  databaseUrl: string;
}>;

/** The variables of the «Conversazioni» component; this module alone owns their defaults. */
export const conversationVariables = {
  databaseUrl: { name: 'AMBROGIO_DATABASE_URL' },
  language: { name: 'AMBROGIO_LANGUAGE', default: { environments: 'all', value: 'en' } },
  timeZone: { name: 'AMBROGIO_TIME_ZONE', default: { environments: 'all', value: 'UTC' } },
  listPageSize: { name: 'AMBROGIO_LIST_PAGE_SIZE', default: { environments: 'all', value: '20' } },
  maxListPageSize: { name: 'AMBROGIO_MAX_LIST_PAGE_SIZE', default: { environments: 'all', value: '100' } },
  historyTurns: { name: 'AMBROGIO_HISTORY_TURNS', default: { environments: 'all', value: '20' } },
} as const satisfies Record<string, EnvironmentVariable>;

/** The parts of the archive URL that the driver receives one by one. */
export type PostgresConnection = Readonly<{
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}>;

const defaultPostgresPort = 5432;

function decoded(value: string): string | undefined {
  try { return decodeURIComponent(value); } catch { return undefined; }
}

/**
 * The connection named by a `postgres:` or `postgresql:` URL with host, user, password and database, and without
 * query or fragment («Indirizzo del database nella configurazione Conversazioni»); undefined for any other value.
 */
export function postgresConnection(value: string): PostgresConnection | undefined {
  // An empty query or fragment leaves no trace in the parsed URL: the raw separators are refused too.
  if (value.includes('?') || value.includes('#')) return undefined;
  let url: URL;
  try { url = new URL(value); } catch { return undefined; }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return undefined;
  const database = /^\/([^/]+)$/.exec(url.pathname)?.[1];
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  const user = decoded(url.username);
  const password = decoded(url.password);
  const name = database === undefined ? undefined : decoded(database);
  if (!host || !user || !password || !name) return undefined;
  return { host, port: url.port === '' ? defaultPostgresPort : Number(url.port), user, password, database: name };
}

function validTimeZone(name: string): boolean {
  try { new Intl.DateTimeFormat('en-GB', { timeZone: name }); return true; }
  catch { return false; }
}

/** Read and validate the conversation component's configuration before constructing its resources. */
export function readConversationConfig(environment: NodeJS.ProcessEnv, runtime: RuntimeEnvironment): ConversationConfig {
  const variables = conversationVariables;
  const databaseUrl = requireVariable(environment, runtime, variables.databaseUrl);
  if (!postgresConnection(databaseUrl)) {
    throw invalidVariable(variables.databaseUrl.name, 'expected a PostgreSQL URL without parameters');
  }
  const language = requireVariable(environment, runtime, variables.language);
  if (language !== 'en' && language !== 'it') throw invalidVariable(variables.language.name, 'expected en or it');
  const timeZone = requireVariable(environment, runtime, variables.timeZone);
  if (!validTimeZone(timeZone)) throw invalidVariable(variables.timeZone.name, 'expected an IANA time zone name');
  const listPageSize = integerVariable(variables.listPageSize.name,
    requireVariable(environment, runtime, variables.listPageSize), 1);
  const maxListPageSize = integerVariable(variables.maxListPageSize.name,
    requireVariable(environment, runtime, variables.maxListPageSize), 1);
  if (listPageSize > maxListPageSize) {
    throw invalidVariable(variables.listPageSize.name, `expected at most ${variables.maxListPageSize.name}`);
  }
  const historyTurns = integerVariable(variables.historyTurns.name,
    requireVariable(environment, runtime, variables.historyTurns), 1);
  return { databaseUrl, language, timeZone, listPageSize, maxListPageSize, historyTurns };
}

