import { writeSync } from 'node:fs';
import type { EventEmitter } from 'node:events';

export type FatalPathTarget = Pick<EventEmitter, 'on'> & Readonly<{ exit(code: number): never | void }>;

/**
 * The fatal path of the process («Percorso fatale separato»): an error that escaped every controlled boundary,
 * including an unhandled rejection, writes one fixed line on stderr without reading the raised value and ends the
 * process with code 1. The `unhandledRejection` handler stands for `--unhandled-rejections=strict`, so every start
 * command behaves the same. Installed by the entry point before the application code is loaded.
 */
export function installFatalPath(message: string, target: FatalPathTarget = process): void {
  const fail = () => {
    try { writeSync(2, `${message}\n`); } catch { /* exit even when stderr is not writable */ }
    target.exit(1);
  };
  target.on('uncaughtException', fail);
  target.on('unhandledRejection', fail);
}
