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
  archivePath: string;
}>;

/** The variables of the «Conversazioni» component; this module alone owns their defaults. */
export const conversationVariables = {
  archivePath: { name: 'AMBROGIO_ARCHIVE_PATH' },
  language: { name: 'AMBROGIO_LANGUAGE', default: { environments: 'all', value: 'en' } },
  timeZone: { name: 'AMBROGIO_TIME_ZONE', default: { environments: 'all', value: 'UTC' } },
  listPageSize: { name: 'AMBROGIO_LIST_PAGE_SIZE', default: { environments: 'all', value: '20' } },
  maxListPageSize: { name: 'AMBROGIO_MAX_LIST_PAGE_SIZE', default: { environments: 'all', value: '100' } },
  historyTurns: { name: 'AMBROGIO_HISTORY_TURNS', default: { environments: 'all', value: '20' } },
} as const satisfies Record<string, EnvironmentVariable>;

function validTimeZone(name: string): boolean {
  try { new Intl.DateTimeFormat('en-GB', { timeZone: name }); return true; }
  catch { return false; }
}

/** Read and validate the conversation component's configuration before constructing its resources. */
export function readConversationConfig(environment: NodeJS.ProcessEnv, runtime: RuntimeEnvironment): ConversationConfig {
  const variables = conversationVariables;
  const archivePath = requireVariable(environment, runtime, variables.archivePath);
  if (!archivePath.trim()) throw invalidVariable(variables.archivePath.name, 'expected a file path');
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
  return { archivePath, language, timeZone, listPageSize, maxListPageSize, historyTurns };
}

