import { ProjectError } from '../../project-error.js';

/** The runtime environment every process declares in `AMBROGIO_ENV`, without a default. */
export type RuntimeEnvironment = 'development' | 'test' | 'production';

/** A default value owned by the configuration module that declares the variable. */
export type VariableDefault = Readonly<{ environments: 'all' | 'development'; value: string }>;

/** One environment variable read by a configuration module, with its default when one is decided. */
export type EnvironmentVariable = Readonly<{ name: string; default?: VariableDefault }>;

export const runtimeEnvironmentVariable: EnvironmentVariable = { name: 'AMBROGIO_ENV' };

const runtimeEnvironments: readonly RuntimeEnvironment[] = ['development', 'test', 'production'];

/** Missing value: the message names the variable only. */
export function missingVariable(name: string): ProjectError {
  return new ProjectError(`Missing environment variable ${name}`);
}

/** Invalid value: the message names the variable and the unmet condition, never the value. */
export function invalidVariable(name: string, condition: string): ProjectError {
  return new ProjectError(`Invalid environment variable ${name}: ${condition}`);
}

/** Read `AMBROGIO_ENV`; an empty variable counts as missing. */
export function readRuntimeEnvironment(environment: NodeJS.ProcessEnv): RuntimeEnvironment {
  const value = environment[runtimeEnvironmentVariable.name];
  if (value === undefined || value === '') throw missingVariable(runtimeEnvironmentVariable.name);
  if (!runtimeEnvironments.includes(value as RuntimeEnvironment)) {
    throw invalidVariable(runtimeEnvironmentVariable.name, 'expected development, test or production');
  }
  return value as RuntimeEnvironment;
}

/**
 * The value of a variable, or its default when the variable is absent or empty and a default is
 * declared for the running environment; `undefined` when neither applies.
 */
export function readVariable(environment: NodeJS.ProcessEnv, runtime: RuntimeEnvironment,
  variable: EnvironmentVariable): string | undefined {
  const value = environment[variable.name];
  if (value !== undefined && value !== '') return value;
  const fallback = variable.default;
  if (fallback && (fallback.environments === 'all' || fallback.environments === runtime)) return fallback.value;
  return undefined;
}

/** Like `readVariable`, but an absent value without a default stops the configuration load. */
export function requireVariable(environment: NodeJS.ProcessEnv, runtime: RuntimeEnvironment,
  variable: EnvironmentVariable): string {
  const value = readVariable(environment, runtime, variable);
  if (value === undefined) throw missingVariable(variable.name);
  return value;
}

/** A decimal integer within the given bounds. */
export function integerVariable(name: string, value: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER,
  condition = `expected an integer from ${minimum}${maximum === Number.MAX_SAFE_INTEGER ? '' : ` to ${maximum}`}`): number {
  const parsed = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw invalidVariable(name, condition);
  return parsed;
}
