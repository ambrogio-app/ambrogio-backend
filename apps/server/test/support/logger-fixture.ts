import { createResourceStack } from '../../src/runtime/lifecycle.js';
import { createBaseLogger, type LogFields, type Logger } from '../../src/runtime/logger.js';

export type LoggedEvent = Readonly<{
  level: 'debug' | 'info' | 'warn' | 'error';
  fields: LogFields;
  message: string | undefined;
  /** Fixed fields of the derived logger that emitted the event. */
  bindings: LogFields;
}>;

/** A logger that records every call with the bindings of the derived logger that made it. */
export function recordingLogger() {
  const events: LoggedEvent[] = [];
  const derive = (bindings: LogFields): Logger => {
    const emit = (level: LoggedEvent['level']) => (fields: LogFields, message?: string) => {
      events.push({ level, fields, message, bindings });
    };
    return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error'),
      child: fields => derive({ ...bindings, ...fields }) };
  };
  return { log: derive({}), events };
}

/** The real base logger of the backend writing to memory, with the emitted JSON lines parsed. */
export function capturedBaseLogger() {
  const output: string[] = [];
  const log = createBaseLogger({ write: (chunk: string) => { output.push(chunk); } });
  return { log, output, lines: () => output.join('').split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>) };
}

/** What the HTTP surface needs from its composition root in a test: a recording logger and a closing stack. */
export function surfaceOptions() {
  const recorder = recordingLogger();
  return { log: recorder.log, resources: createResourceStack(), events: recorder.events };
}

/** A logger that records every call, like `recordingLogger`, and forwards it to `target`. */
export function teeLogger(target: Logger) {
  const events: LoggedEvent[] = [];
  const derive = (bindings: LogFields, forward: Logger): Logger => {
    const emit = (level: LoggedEvent['level']) => (fields: LogFields, message?: string) => {
      events.push({ level, fields, message, bindings });
      forward[level](fields, message);
    };
    return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error'),
      child: fields => derive({ ...bindings, ...fields }, forward.child(fields)) };
  };
  return { log: derive({}, target), events };
}
