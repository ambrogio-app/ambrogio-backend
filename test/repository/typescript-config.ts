// Reads the TypeScript configurations of the repository as `tsc` resolves them.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { repositoryRoot } from './source-imports.js';

type TsConfig = Readonly<{ extends?: string; compilerOptions?: Readonly<Record<string, unknown>> }>;

/** The effective compiler options of a configuration, following `extends` from the base to the configuration itself. */
export function effectiveOptions(path: string): Record<string, unknown> {
  const config = JSON.parse(readFileSync(join(repositoryRoot, path), 'utf8')) as TsConfig;
  const base = config.extends === undefined ? {} : effectiveOptions(join(dirname(path), config.extends));
  return { ...base, ...config.compilerOptions };
}
