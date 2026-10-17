import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { pino, type DestinationStream } from 'pino';

/** The controlled `err` view: project errors are ours, anything else stays opaque. */
function serializeStartupError(value: unknown): Readonly<{ type: string; message: string; stack: string }> {
  return value instanceof ProjectError
    ? { type: value.name, message: value.message, stack: value.stack ?? '' }
    : { type: 'Error', message: 'Unexpected startup failure', stack: '[redacted]' };
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown startup failure', { cause: value });
}

/** Definitive boundary for failures before the server listens: one JSON event, one stderr line. */
export function reportStartupFailure(error: unknown, output: Readonly<{
  stdout: DestinationStream; stderr: Pick<NodeJS.WritableStream, 'write'>;
}> = { stdout: process.stdout, stderr: process.stderr }): void {
  const logger = pino({ serializers: { err: serializeStartupError } }, output.stdout);
  logger.error({ event: 'server_startup_failed', err: normalizeError(error) }, 'Server startup failed');
  output.stderr.write('Unable to start HTTP server.\n');
}

/** Name the startup phase of an external failure; project errors already say what went wrong. */
export async function startupPhase<T>(message: string, work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError(message, { cause: error });
  }
}
