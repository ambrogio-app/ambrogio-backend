import type { EventEmitter } from 'node:events';
import { collectFaults, startupWithCleanup } from './lifecycle.js';
import type { Logger } from './logger.js';
import { reportStartupFailure, startupPhase } from './startup-failure.js';

/** What the runner needs of a built entry point: its activation and its single closing. */
export type BuiltEntryPoint = Readonly<{
  close(): Promise<void>;
  /** Faults observed by the closing so far, also while it is still in progress. */
  readonly faults: readonly unknown[];
}>;

/** Single deferred execution that can be cancelled; it never keeps the process alive by itself. */
export type ShutdownTimer = (delayMs: number, callback: () => void) => Readonly<{ cancel(): void }>;

/** The outcome decided by the runner; only the entry point turns it into the exit of the process. */
export type ProcessOutcome = Readonly<{
  exitCode: number;
  /** True when the shutdown window expired: the entry point exits without waiting for pending closings. */
  force: boolean;
}>;

export type ServerProcessOptions<T extends BuiltEntryPoint> = Readonly<{
  /** Construction of the entry point, without activation («Costruzione del server separata dall'ascolto»). */
  build(): Promise<T>;
  /** Activation of the built entry point, for example listening on its address. */
  activate(built: T): Promise<void>;
  log: Logger;
  stderr?: (line: string) => void;
  signals?: Pick<EventEmitter, 'on' | 'off'>;
  timer?: ShutdownTimer;
}>;

/** Upper bound of the orderly shutdown started by the first SIGINT or SIGTERM («Finestra di arresto del server»). */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

export const unrefShutdownTimer: ShutdownTimer = (delayMs, callback) => {
  const handle = setTimeout(callback, delayMs);
  handle.unref();
  return { cancel: () => clearTimeout(handle) };
};

/** Open the listener of a built conversation server; a failure names the phase. */
export function listen(built: Readonly<{ server: Readonly<{ listen(address: Readonly<{ host: string;
  port: number }>): Promise<unknown> }>; address: Readonly<{ host: string; port: number }> }>): Promise<void> {
  return startupPhase('HTTP listener could not start', async () => { await built.server.listen(built.address); });
}

type Settled<V> = Readonly<{ kind: 'value'; value: V }> | Readonly<{ kind: 'error'; error: unknown }>;

function settle<V>(promise: Promise<V>): Promise<Settled<V>> {
  return promise.then(value => ({ kind: 'value', value }), (error: unknown) => ({ kind: 'error', error }));
}

/**
 * The testable runner of the server process: it builds and activates the entry point, waits for the first SIGINT or
 * SIGTERM, runs the single shutdown within the shutdown window and decides the outcome. The window starts at the
 * first signal, also while the construction or the activation is still in progress, and bounds them too. It owns
 * the definitive logs of startup and shutdown failures and never calls `process.exit`.
 */
export async function runServerProcess<T extends BuiltEntryPoint>(options: ServerProcessOptions<T>):
  Promise<ProcessOutcome> {
  const { log, signals = process, timer = unrefShutdownTimer,
    stderr = line => { process.stderr.write(line); } } = options;
  let requestStop!: () => void;
  const requested = new Promise<void>(resolve => { requestStop = resolve; });
  let expire!: () => void;
  const expired = new Promise<'expired'>(resolve => { expire = () => resolve('expired'); });
  let deadline: ReturnType<ShutdownTimer> | undefined;
  const stop = () => {
    // The first signal arms the single shutdown window; the following ones share it.
    deadline ??= timer(SHUTDOWN_TIMEOUT_MS, expire);
    requestStop();
  };
  signals.on('SIGINT', stop);
  signals.on('SIGTERM', stop);
  try {
    const building = await Promise.race([settle(options.build()), expired]);
    if (building === 'expired') return timedOut(log, []);
    if (building.kind === 'error') {
      reportStartupFailure(building.error, log, stderr);
      return { exitCode: 1, force: false };
    }
    const built = building.value;
    if (deadline === undefined) {
      const activation = await Promise.race([settle(options.activate(built)), expired]);
      if (activation === 'expired') return timedOut(log, built.faults);
      if (activation.kind === 'error') {
        const cleanup = await built.close().then(() => [], () => built.faults);
        reportStartupFailure(startupWithCleanup('Server startup failed', activation.error, cleanup), log, stderr);
        return { exitCode: 1, force: false };
      }
      await requested;
    }
    return await shutdown(built, log, expired);
  } finally {
    deadline?.cancel();
    signals.off('SIGINT', stop);
    signals.off('SIGTERM', stop);
  }
}

function timedOut(log: Logger, faults: readonly unknown[]): ProcessOutcome {
  log.error({ event: 'server_shutdown_timeout', timeoutMs: SHUTDOWN_TIMEOUT_MS,
    ...(faults.length > 0 ? { err: collectFaults('Server shutdown timed out', faults) } : {}) },
  'Server shutdown timed out');
  return { exitCode: 1, force: true };
}

async function shutdown(built: BuiltEntryPoint, log: Logger, expired: Promise<'expired'>): Promise<ProcessOutcome> {
  const closing = built.close().then(() => 'closed' as const, (error: unknown) => ({ error }));
  const result = await Promise.race([closing, expired]);
  if (result === 'closed') return { exitCode: 0, force: false };
  if (result === 'expired') return timedOut(log, built.faults);
  log.error({ event: 'server_shutdown_failed', err: result.error }, 'Server shutdown failed');
  return { exitCode: 1, force: false };
}
