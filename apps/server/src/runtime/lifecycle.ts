import { ProjectError } from '@ambrogio/conversations/application/project-error';

/** Independent faults of one lifecycle, in the order they were observed; none is the cause of another. */
export class LifecycleError extends ProjectError {
  readonly faults: readonly unknown[];

  constructor(message: string, faults: readonly unknown[]) {
    super(message);
    this.name = 'LifecycleError';
    this.faults = faults;
  }
}

/** One fault keeps its identity; several are collected, in order, in a lifecycle error. */
export function collectFaults(message: string, faults: readonly unknown[]): unknown {
  return faults.length === 1 ? faults[0] : new LifecycleError(message, [...faults]);
}

/** A failed startup stays the first fault; failed cleanups follow it without becoming its cause. */
export function startupWithCleanup(message: string, failure: unknown, cleanup: readonly unknown[]): unknown {
  return cleanup.length === 0 ? failure : new LifecycleError(message, [failure, ...cleanup]);
}

export type ResourceStack = Readonly<{
  /**
   * Register the closing of a resource right after acquiring it; `failure` names the resource when the closing fails
   * with an error that is not already a project error.
   */
  defer(failure: string, close: () => unknown): void;
  /**
   * Close every registered resource once, in reverse order of acquisition, attempting every closing even when one
   * fails. Repeated calls share the same closing. Rejects with the fault, or with a lifecycle error for several.
   */
  close(): Promise<void>;
  /** Faults observed so far, also while the closing is still in progress. */
  readonly faults: readonly unknown[];
}>;

/** The closing stack of a composition root («Ciclo di vita dei processi di servizio con Node.js»). */
export function createResourceStack(failure = 'Resources could not be closed'): ResourceStack {
  const closings: { failure: string; close: () => unknown }[] = [];
  const faults: unknown[] = [];
  let closing: Promise<void> | undefined;
  return {
    defer(message, close) {
      if (closing) throw new ProjectError('Resource acquired after closing started');
      closings.push({ failure: message, close });
    },
    close() {
      closing ??= (async () => {
        for (const entry of closings.splice(0).reverse()) {
          try { await entry.close(); }
          catch (error) {
            // A project error already names what failed; any other failure is named by its resource.
            faults.push(error instanceof ProjectError ? error : new ProjectError(entry.failure, { cause: error }));
          }
        }
        if (faults.length > 0) throw collectFaults(failure, faults);
      })();
      return closing;
    },
    get faults() { return [...faults]; },
  };
}
