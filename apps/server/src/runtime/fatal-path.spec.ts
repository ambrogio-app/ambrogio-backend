import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const modulePath = fileURLToPath(new URL('./fatal-path.ts', import.meta.url));
const marker = 'PRIVATE_FATAL_MARKER';

/** Run a Node.js child that installs the backend's fatal path, then raises `raise`. */
function runFatal(raise: string) {
  const script = [
    `import { installFatalPath } from ${JSON.stringify(modulePath)};`,
    "installFatalPath('Ambrogio backend stopped after a fatal error.');",
    raise,
    "setTimeout(() => { console.log('still running'); }, 500);",
  ].join('\n');
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10_000 });
}

describe('fatal path of the backend process', () => {
  // Verification: Prova del percorso fatale del server
  it.each([
    ['an uncaught exception', `setTimeout(() => { throw Object.assign(new Error('${marker}'), { detail: '${marker}' }); });`],
    ['an unhandled rejection', `void Promise.reject(Object.assign(new Error('${marker}'), { detail: '${marker}' }));`],
  ])('writes only the fixed line on stderr and exits with 1 after %s', (_label, raise) => {
    const result = runFatal(raise);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('Ambrogio backend stopped after a fatal error.\n');
    expect(result.stdout).toBe('');
    expect(`${result.stdout}${result.stderr}`).not.toContain(marker);
  });

  // Verification: Prova del percorso fatale del server
  it('is installed by the entry point before the application code is loaded dynamically', () => {
    const main = readFileSync(fileURLToPath(new URL('../main.ts', import.meta.url)), 'utf8');
    const staticImports = [...main.matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]);
    expect(staticImports).toEqual(['./runtime/fatal-path.js']);
    expect(main.indexOf('installFatalPath(')).toBeLessThan(main.indexOf('import(\'./runtime/logger.js\')'));
  });
});
