import { ProjectError } from '../../project-error.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export type ConversationConfig = Readonly<{
  listPageSize: number;
  maxListPageSize: number;
  language: 'en' | 'it';
  /** IANA name of the family's time zone; UTC when the file does not set one. */
  timeZone: string;
  archivePath?: string;
}>;

let configRevision = 0;

function validTimeZone(name: string): boolean {
  if (!name) return false;
  try { new Intl.DateTimeFormat('en-GB', { timeZone: name }); return true; }
  catch { return false; }
}

/** Load the conversation component's TypeScript module before constructing its resources. */
export async function loadConversationConfig(filename: string): Promise<ConversationConfig> {
  let value: unknown;
  try {
    if (!filename.endsWith('.ts')) throw new Error('Expected TypeScript configuration');
    value = (await import(`${pathToFileURL(resolve(filename)).href}?revision=${++configRevision}`)).default;
  } catch {
    throw new ProjectError('Invalid conversation configuration file');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProjectError('Invalid conversation configuration file');
  }
  const fields = value as Record<string, unknown>;
  const listPageSize = fields.listPageSize === undefined ? 20 : fields.listPageSize;
  const maxListPageSize = fields.maxListPageSize === undefined ? 100 : fields.maxListPageSize;
  if (typeof listPageSize !== 'number' || !Number.isSafeInteger(listPageSize) || listPageSize < 1
    || typeof maxListPageSize !== 'number' || !Number.isSafeInteger(maxListPageSize)
    || maxListPageSize < 1 || listPageSize > maxListPageSize) {
    throw new ProjectError('Invalid conversation list limits');
  }
  if (fields.language !== undefined && typeof fields.language !== 'string') {
    throw new ProjectError('Invalid conversation language');
  }
  const language = fields.language === 'it' ? 'it' : 'en';
  if (fields.archivePath !== undefined
    && (typeof fields.archivePath !== 'string' || !fields.archivePath.trim())) {
    throw new ProjectError('Invalid conversation archive path');
  }
  const timeZone = fields.timeZone === undefined ? 'UTC' : fields.timeZone;
  if (typeof timeZone !== 'string' || !validTimeZone(timeZone)) {
    throw new ProjectError('Invalid conversation time zone');
  }
  return { listPageSize, maxListPageSize, language, timeZone,
    ...(fields.archivePath === undefined ? {} : { archivePath: fields.archivePath }) };
}
