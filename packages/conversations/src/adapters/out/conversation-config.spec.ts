import { describe, expect, it } from 'vitest';
import { postgresConnection, readConversationConfig } from './conversation-config.js';
import type { RuntimeEnvironment } from './environment-variables.js';

const archive = { AMBROGIO_DATABASE_URL: 'postgres://ambrogio:placeholder@127.0.0.1:5432/ambrogio' };
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
      expect(read({}, runtime)).toEqual({ databaseUrl: 'postgres://ambrogio:placeholder@127.0.0.1:5432/ambrogio', listPageSize: 20,
        maxListPageSize: 100, historyTurns: 20, language: 'en', timeZone: 'UTC' });
    }
    expect(read({ AMBROGIO_LIST_PAGE_SIZE: '2', AMBROGIO_MAX_LIST_PAGE_SIZE: '3' }))
      .toMatchObject({ listPageSize: 2, maxListPageSize: 3 });
    expect(read({ AMBROGIO_LIST_PAGE_SIZE: '110', AMBROGIO_MAX_LIST_PAGE_SIZE: '120' }))
      .toMatchObject({ listPageSize: 110, maxListPageSize: 120 });
    // An empty variable counts as an absent one.
    expect(read({ AMBROGIO_LIST_PAGE_SIZE: '', AMBROGIO_LANGUAGE: '' })).toMatchObject({ listPageSize: 20, language: 'en' });
  });

  // Verification: Prova della finestra dello storico dei modelli
  it('reads the history window with its default and rejects invalid values naming the variable', () => {
    for (const runtime of ['development', 'test', 'production'] as const) {
      expect(read({}, runtime).historyTurns).toBe(20);
    }
    expect(read({ AMBROGIO_HISTORY_TURNS: '1' }).historyTurns).toBe(1);
    expect(read({ AMBROGIO_HISTORY_TURNS: '500' }).historyTurns).toBe(500);
    for (const value of ['0', '-1', '1.5', 'twenty', ' 20']) {
      expect(failure({ AMBROGIO_HISTORY_TURNS: value })).toMatch(/^Invalid environment variable AMBROGIO_HISTORY_TURNS: /);
    }
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
  it('requires a PostgreSQL URL without parameters in every environment', () => {
    for (const url of ['postgres://ambrogio:placeholder@database:5432/ambrogio', 'postgresql://ambrogio:placeholder@localhost/ambrogio']) {
      expect(read({ AMBROGIO_DATABASE_URL: url }).databaseUrl).toBe(url);
    }
    expect(postgresConnection('postgres://ambrogio:place%40holder@database:5433/ambrogio')).toEqual({
      host: 'database', port: 5433, user: 'ambrogio', password: 'place@holder', database: 'ambrogio' });
    expect(postgresConnection('postgresql://ambrogio:placeholder@[::1]/ambrogio')).toEqual({
      host: '::1', port: 5432, user: 'ambrogio', password: 'placeholder', database: 'ambrogio' });
    for (const runtime of ['development', 'test', 'production'] as const) {
      expect(() => readConversationConfig({}, runtime)).toThrow('Missing environment variable AMBROGIO_DATABASE_URL');
      expect(() => readConversationConfig({ AMBROGIO_DATABASE_URL: '' }, runtime))
        .toThrow('Missing environment variable AMBROGIO_DATABASE_URL');
    }
    for (const url of ['  ', '/data/conversations.sqlite', 'mysql://ambrogio:placeholder@database/ambrogio',
      'postgres://ambrogio:placeholder@database:5432', 'postgres://ambrogio:placeholder@database:5432/',
      'postgres://ambrogio:placeholder@database/ambrogio?sslmode=require', 'postgres://ambrogio:placeholder@database/a/b',
      'postgres://ambrogio@database/ambrogio', 'postgres://ambrogio:@database/ambrogio',
      'postgres://:placeholder@database/ambrogio', 'postgres://database/ambrogio',
      'postgres://ambrogio:placeholder@database/ambrogio#fragment', 'postgres://ambrogio:placeholder@database/ambrogio#',
      'postgres://ambrogio:placeholder@database/ambrogio?', 'postgres://ambrogio:placeholder@/ambrogio']) {
      const message = failure({ AMBROGIO_DATABASE_URL: url });
      expect(message, url).toBe('Invalid environment variable AMBROGIO_DATABASE_URL: expected a PostgreSQL URL without parameters');
    }
  });

  // Verification: Prova del bootstrap della configurazione del backend
  it('never shows the rejected value in its errors', () => {
    for (const name of ['AMBROGIO_DATABASE_URL', 'AMBROGIO_LANGUAGE', 'AMBROGIO_TIME_ZONE', 'AMBROGIO_LIST_PAGE_SIZE', 'AMBROGIO_MAX_LIST_PAGE_SIZE']) {
      const message = failure({ [name]: marker });
      expect(message).toContain(name);
      expect(message).not.toContain(marker);
    }
  });
});
