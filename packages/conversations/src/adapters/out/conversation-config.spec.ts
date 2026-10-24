import { describe, expect, it } from 'vitest';
import { readConversationConfig } from './conversation-config.js';
import type { RuntimeEnvironment } from './environment-variables.js';

const archive = { AMBROGIO_ARCHIVE_PATH: '/tmp/ambrogio.sqlite' };
const read = (variables: Record<string, string>, runtime: RuntimeEnvironment = 'test') =>
  readConversationConfig({ ...archive, ...variables }, runtime);
const marker = 'marker-value-7c1e';

/** The message of the error thrown by a read, to check that it names the variable and not its value. */
function failure(variables: Record<string, string>, runtime: RuntimeEnvironment = 'test'): string {
  try { read(variables, runtime); } catch (error) { return (error as Error).message; }
  throw new Error('The configuration was accepted');
}

describe('conversation component configuration', () => {
  // Verification: Prova della configurazione della paginazione
  it('applies its own defaults in every environment and accepts explicit page limits', () => {
    for (const runtime of ['development', 'test', 'production'] as const) {
      expect(read({}, runtime)).toEqual({ archivePath: '/tmp/ambrogio.sqlite', listPageSize: 20,
        maxListPageSize: 100, language: 'en', timeZone: 'UTC' });
    }
    expect(read({ AMBROGIO_LIST_PAGE_SIZE: '2', AMBROGIO_MAX_LIST_PAGE_SIZE: '3' }))
      .toMatchObject({ listPageSize: 2, maxListPageSize: 3 });
    expect(read({ AMBROGIO_LIST_PAGE_SIZE: '110', AMBROGIO_MAX_LIST_PAGE_SIZE: '120' }))
      .toMatchObject({ listPageSize: 110, maxListPageSize: 120 });
    // An empty variable counts as an absent one.
    expect(read({ AMBROGIO_LIST_PAGE_SIZE: '', AMBROGIO_LANGUAGE: '' })).toMatchObject({ listPageSize: 20, language: 'en' });
  });

  // Verification: Prova della configurazione della paginazione
  it('rejects invalid page limits naming the variable', () => {
    for (const value of ['0', '-1', '1.5', 'twenty', ' 20']) {
      expect(failure({ AMBROGIO_LIST_PAGE_SIZE: value })).toMatch(/^Invalid environment variable AMBROGIO_LIST_PAGE_SIZE: /);
      expect(failure({ AMBROGIO_MAX_LIST_PAGE_SIZE: value })).toMatch(/^Invalid environment variable AMBROGIO_MAX_LIST_PAGE_SIZE: /);
    }
    expect(failure({ AMBROGIO_LIST_PAGE_SIZE: '101' }))
      .toBe('Invalid environment variable AMBROGIO_LIST_PAGE_SIZE: expected at most AMBROGIO_MAX_LIST_PAGE_SIZE');
  });

  it('selects English or Italian and rejects any other language', () => {
    expect(read({ AMBROGIO_LANGUAGE: 'en' }).language).toBe('en');
    expect(read({ AMBROGIO_LANGUAGE: 'it' }).language).toBe('it');
    for (const language of ['fr', 'IT', 'italian']) {
      expect(failure({ AMBROGIO_LANGUAGE: language })).toBe('Invalid environment variable AMBROGIO_LANGUAGE: expected en or it');
    }
  });

  // Verification: Prova del fuso orario configurato
  it('uses UTC without a time zone, keeps a valid one and rejects invalid ones', () => {
    expect(read({}).timeZone).toBe('UTC');
    expect(read({ AMBROGIO_TIME_ZONE: 'Europe/Rome' }).timeZone).toBe('Europe/Rome');
    for (const timeZone of ['Mars/Olympus', '7']) {
      expect(failure({ AMBROGIO_TIME_ZONE: timeZone }))
        .toBe('Invalid environment variable AMBROGIO_TIME_ZONE: expected an IANA time zone name');
    }
  });

  // Verification: Prova dell'archivio configurato all'avvio
  it('requires the archive path in every environment', () => {
    expect(read({ AMBROGIO_ARCHIVE_PATH: '/data/conversations.sqlite' }).archivePath).toBe('/data/conversations.sqlite');
    for (const runtime of ['development', 'test', 'production'] as const) {
      expect(() => readConversationConfig({}, runtime)).toThrow('Missing environment variable AMBROGIO_ARCHIVE_PATH');
      expect(() => readConversationConfig({ AMBROGIO_ARCHIVE_PATH: '' }, runtime))
        .toThrow('Missing environment variable AMBROGIO_ARCHIVE_PATH');
    }
    expect(failure({ AMBROGIO_ARCHIVE_PATH: '  ' })).toBe('Invalid environment variable AMBROGIO_ARCHIVE_PATH: expected a file path');
  });

  // Verification: Prova del bootstrap della configurazione del backend
  it('never shows the rejected value in its errors', () => {
    for (const name of ['AMBROGIO_LANGUAGE', 'AMBROGIO_TIME_ZONE', 'AMBROGIO_LIST_PAGE_SIZE', 'AMBROGIO_MAX_LIST_PAGE_SIZE']) {
      const message = failure({ [name]: marker });
      expect(message).toContain(name);
      expect(message).not.toContain(marker);
    }
  });
});
