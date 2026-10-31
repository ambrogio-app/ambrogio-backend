import { describe, expect, it } from 'vitest';
import type { RuntimeEnvironment } from '@ambrogio/conversations/adapters/out/environment-variables';
import { readHttpConfig } from './http-config.js';

const explicit = { AMBROGIO_HTTP_HOST: '0.0.0.0', AMBROGIO_HTTP_PORT: '3030', AMBROGIO_PUBLIC_HTTPS: 'false' };
const marker = 'marker-value-91d3';

function failure(variables: Record<string, string | undefined>, runtime: RuntimeEnvironment = 'production'): string {
  try { readHttpConfig(variables, runtime); } catch (error) { return (error as Error).message; }
  throw new Error('The configuration was accepted');
}

// Verification: Prova della configurazione esplicita del listener HTTP
describe('HTTP component configuration', () => {
  it('applies the development defaults only in development', () => {
    expect(readHttpConfig({}, 'development')).toEqual({ host: '127.0.0.1', port: 3000, allowedOrigins: [],
      publicHttps: false });
    expect(readHttpConfig({ AMBROGIO_HTTP_HOST: '', AMBROGIO_HTTP_PORT: '' }, 'development'))
      .toMatchObject({ host: '127.0.0.1', port: 3000 });
    for (const runtime of ['test', 'production'] as const) {
      for (const name of Object.keys(explicit)) {
        expect(failure({ ...explicit, [name]: undefined }, runtime)).toBe(`Missing environment variable ${name}`);
        expect(failure({ ...explicit, [name]: '' }, runtime)).toBe(`Missing environment variable ${name}`);
      }
    }
  });

  it('uses exactly the explicit values in every environment', () => {
    for (const runtime of ['development', 'test', 'production'] as const) {
      expect(readHttpConfig(explicit, runtime)).toEqual({ host: '0.0.0.0', port: 3030, allowedOrigins: [],
        publicHttps: false });
    }
  });

  it('rejects an invalid port or public HTTPS flag naming the variable', () => {
    for (const port of ['0', '65536', '-1', '30.5', 'http', ' 3030']) {
      expect(failure({ ...explicit, AMBROGIO_HTTP_PORT: port }))
        .toBe('Invalid environment variable AMBROGIO_HTTP_PORT: expected an integer from 1 to 65535');
    }
    expect(failure({ ...explicit, AMBROGIO_HTTP_HOST: '  ' }))
      .toBe('Invalid environment variable AMBROGIO_HTTP_HOST: expected a host address');
    for (const flag of ['yes', 'TRUE', '1']) {
      expect(failure({ ...explicit, AMBROGIO_PUBLIC_HTTPS: flag }))
        .toBe('Invalid environment variable AMBROGIO_PUBLIC_HTTPS: expected true or false');
    }
  });

  // Verification: Prova delle origini CORS dell'API HTTP
  it('accepts exact CORS origins only', () => {
    expect(readHttpConfig({ ...explicit, AMBROGIO_ALLOWED_ORIGINS: 'https://chat.example.test, http://127.0.0.1:8080' },
      'production').allowedOrigins).toEqual(['https://chat.example.test', 'http://127.0.0.1:8080']);
    // Items are trimmed and empty items are ignored.
    expect(readHttpConfig({ ...explicit, AMBROGIO_ALLOWED_ORIGINS: ' https://a.example.test ,, https://b.example.test,' },
      'production').allowedOrigins).toEqual(['https://a.example.test', 'https://b.example.test']);
    expect(readHttpConfig({ ...explicit, AMBROGIO_ALLOWED_ORIGINS: ' , ' }, 'production').allowedOrigins).toEqual([]);
    for (const origins of ['*', 'https://example.test/path', 'ftp://example.test', 'example.test',
      'https://example.test,*', 'https://example.test/']) {
      expect(failure({ ...explicit, AMBROGIO_ALLOWED_ORIGINS: origins }))
        .toBe('Invalid environment variable AMBROGIO_ALLOWED_ORIGINS: expected comma-separated exact HTTP or HTTPS origins');
    }
  });

  it('requires a positive HSTS duration with public HTTPS', () => {
    expect(readHttpConfig({ ...explicit, AMBROGIO_PUBLIC_HTTPS: 'true', AMBROGIO_HSTS_MAX_AGE_SECONDS: '600' },
      'production')).toMatchObject({ publicHttps: true, hstsMaxAgeSeconds: 600 });
    expect(failure({ ...explicit, AMBROGIO_PUBLIC_HTTPS: 'true' }))
      .toBe('Invalid environment variable AMBROGIO_HSTS_MAX_AGE_SECONDS: required when AMBROGIO_PUBLIC_HTTPS is true');
    for (const maxAge of ['0', '-5', 'year']) {
      expect(failure({ ...explicit, AMBROGIO_PUBLIC_HTTPS: 'true', AMBROGIO_HSTS_MAX_AGE_SECONDS: maxAge }))
        .toMatch(/^Invalid environment variable AMBROGIO_HSTS_MAX_AGE_SECONDS: /);
    }
  });

  it('never shows the rejected value in its errors', () => {
    for (const name of ['AMBROGIO_HTTP_PORT', 'AMBROGIO_PUBLIC_HTTPS', 'AMBROGIO_ALLOWED_ORIGINS']) {
      const message = failure({ ...explicit, [name]: marker });
      expect(message).toContain(name);
      expect(message).not.toContain(marker);
    }
  });
});
