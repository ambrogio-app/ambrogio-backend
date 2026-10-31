import type { LogFields, Logger } from '../../src/adapters/in/diagnostic-log.port.js';

export type LoggedEvent = Readonly<{
  level: 'debug' | 'info' | 'warn' | 'error';
  fields: LogFields;
  message: string | undefined;
  /** Fixed fields of the derived logger that emitted the event. */
  bindings: LogFields;
}>;

/**
 * A logger that records every call, for the tests of the components that receive the minimal logger. `errors` holds
 * the `[fields, message]` pairs of the `error` calls, `events` every call with the bindings of its derived logger.
 */
export function recordingLogger() {
  const events: LoggedEvent[] = [];
  const errors: unknown[][] = [];
  const derive = (bindings: LogFields): Logger => {
    const emit = (level: LoggedEvent['level']) => (fields: LogFields, message?: string) => {
      events.push({ level, fields, message, bindings });
      if (level === 'error') errors.push([fields, message]);
    };
    return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error'),
      child: fields => derive({ ...bindings, ...fields }) };
  };
  return { log: derive({}), events, errors };
}
