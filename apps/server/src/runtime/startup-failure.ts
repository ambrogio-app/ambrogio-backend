import { ProjectError } from '@ambrogio/conversations/application/project-error';
import type { Logger } from './logger.js';

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown startup failure', { cause: value });
}

/**
 * Definitive boundary for failures before the server listens («Evento diagnostico del mancato avvio del server»):
 * one JSON event through the base logger, one fixed line on stderr.
 */
export function reportStartupFailure(error: unknown, log: Logger,
  stderr: (line: string) => void = line => { process.stderr.write(line); }): void {
  log.error({ event: 'server_startup_failed', err: normalizeError(error) }, 'Server startup failed');
  stderr('Unable to start HTTP server.\n');
}

/** Name the startup phase of an external failure; project errors already say what went wrong. */
export async function startupPhase<T>(message: string, work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError(message, { cause: error });
  }
}
