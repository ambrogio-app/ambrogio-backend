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

/** A `postgres:` or `postgresql:` URL with a host and a database name, and no query parameters. */
function isPostgresUrl(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return (url.protocol === 'postgres:' || url.protocol === 'postgresql:') && url.hostname !== ''
    && /^\/[^/]+$/.test(url.pathname) && url.search === '' && url.hash === '';
}

function validTimeZone(name: string): boolean {
  try { new Intl.DateTimeFormat('en-GB', { timeZone: name }); return true; }
  catch { return false; }
}

/** Read and validate the conversation component's configuration before constructing its resources. */
export function readConversationConfig(environment: NodeJS.ProcessEnv, runtime: RuntimeEnvironment): ConversationConfig {
  const variables = conversationVariables;
  const databaseUrl = requireVariable(environment, runtime, variables.databaseUrl);
  if (!isPostgresUrl(databaseUrl)) {
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

