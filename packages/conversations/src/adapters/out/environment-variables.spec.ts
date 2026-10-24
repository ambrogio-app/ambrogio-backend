import { describe, expect, it } from 'vitest';
import { integerVariable, readRuntimeEnvironment, readVariable, requireVariable,
  type EnvironmentVariable } from './environment-variables.js';

const marker = 'marker-value-3b8e';

// Verification: Prova dell'ambiente di esecuzione del backend
describe('runtime environment', () => {
  it('requires AMBROGIO_ENV without a default', () => {
    expect(() => readRuntimeEnvironment({})).toThrow('Missing environment variable AMBROGIO_ENV');
    expect(() => readRuntimeEnvironment({ AMBROGIO_ENV: '' })).toThrow('Missing environment variable AMBROGIO_ENV');
  });

  it('accepts development, test and production only, without showing another value', () => {
    for (const value of ['development', 'test', 'production'] as const) {
      expect(readRuntimeEnvironment({ AMBROGIO_ENV: value })).toBe(value);
    }
    for (const value of ['Production', 'prod', 'staging', marker]) {
      let message = '';
      try { readRuntimeEnvironment({ AMBROGIO_ENV: value }); } catch (error) { message = (error as Error).message; }
      expect(message).toBe('Invalid environment variable AMBROGIO_ENV: expected development, test or production');
    }
  });
});

// Verification: Prova dell'ambiente di esecuzione del backend
describe('environment variables with defaults', () => {
  const everywhere: EnvironmentVariable = { name: 'SAMPLE_ALL', default: { environments: 'all', value: 'shared' } };
  const development: EnvironmentVariable = { name: 'SAMPLE_DEV', default: { environments: 'development', value: 'local' } };
  const required: EnvironmentVariable = { name: 'SAMPLE_REQUIRED' };

  it('treats an empty variable as an absent one', () => {
    expect(readVariable({ SAMPLE_REQUIRED: '' }, 'production', required)).toBeUndefined();
    expect(readVariable({ SAMPLE_ALL: '' }, 'production', everywhere)).toBe('shared');
    expect(() => requireVariable({ SAMPLE_REQUIRED: '' }, 'production', required))
      .toThrow('Missing environment variable SAMPLE_REQUIRED');
  });

  it('applies a development default only in development and an all-environment default everywhere', () => {
    expect(readVariable({}, 'development', development)).toBe('local');
    for (const runtime of ['test', 'production'] as const) {
      expect(readVariable({}, runtime, development)).toBeUndefined();
      expect(() => requireVariable({}, runtime, development)).toThrow('Missing environment variable SAMPLE_DEV');
    }
    for (const runtime of ['development', 'test', 'production'] as const) {
      expect(readVariable({}, runtime, everywhere)).toBe('shared');
      expect(readVariable({ SAMPLE_ALL: 'explicit', SAMPLE_DEV: 'explicit' }, runtime, everywhere)).toBe('explicit');
      expect(readVariable({ SAMPLE_DEV: 'explicit' }, runtime, development)).toBe('explicit');
    }
  });

  it('converts decimal integers within bounds and names only the variable otherwise', () => {
    expect(integerVariable('SAMPLE_NUMBER', '42', 1, 100)).toBe(42);
    for (const value of ['0', '101', '4.2', '-1', '0x10', '', marker]) {
      expect(() => integerVariable('SAMPLE_NUMBER', value, 1, 100))
        .toThrow('Invalid environment variable SAMPLE_NUMBER: expected an integer from 1 to 100');
    }
  });
});
