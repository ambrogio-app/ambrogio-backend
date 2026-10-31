// Verification: Prova della compilazione TypeScript strict
// The effective `strict` option of every TypeScript project of the server, following `extends`; `pnpm typecheck` and
// `pnpm build` compile them.
import { expect, test } from 'vitest';
import { effectiveOptions } from './typescript-config.js';

test.each(['tsconfig.json', 'packages/conversations/tsconfig.build.json', 'apps/server/tsconfig.build.json'])(
  '%s compiles with the effective option strict', (path) => {
    expect(effectiveOptions(path).strict).toBe(true);
  });
