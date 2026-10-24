import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { pino, type DestinationStream, type Logger as PinoLogger } from 'pino';
import { LifecycleError } from './lifecycle.js';

/** Fields of one diagnostic event, chosen explicitly at the emission point. */
export type LogFields = Readonly<Record<string, unknown>>;

/**
 * The minimal logger the technical components receive («Profilo del logger con Pino»): it names no logging
 * library. This module is the only one of the backend that imports Pino.
 */
export interface Logger {
  debug(fields: LogFields, message?: string): void;
  info(fields: LogFields, message?: string): void;
  warn(fields: LogFields, message?: string): void;
  error(fields: LogFields, message?: string): void;
  /** A derived logger with fixed fields; this logger is left unchanged. */
  child(fields: LogFields): Logger;
}

export type ErrorView = Readonly<{ type: string; message: string; stack: string; faults?: readonly ErrorView[] }>;

/** The constant view of every error not built by the backend and of every unknown thrown value. */
const opaqueError: ErrorView = { type: 'Error', message: 'Unexpected backend failure', stack: '[redacted]' };

/**
 * The controlled `err` view («Profilo controllato di serializzazione di err»): project errors show type, message
 * and stack, a lifecycle error also the views of the faults it collects; anything else stays opaque. The view is a
 * new object and the cause chain is not serialized.
 */
export function errorView(value: unknown): ErrorView {
  if (!(value instanceof ProjectError)) return opaqueError;
  const view = { type: value.name, message: value.message, stack: value.stack ?? '' };
  return value instanceof LifecycleError ? { ...view, faults: value.faults.map(errorView) } : view;
}

const sensitiveName = /token|password|passwd|secret|authorization|cookie|credential|api[-_]?key/i;

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * A copy of `value` where the value of every field with a sensitive name is `[redacted]`, at any depth of plain
 * objects and arrays. Errors and other objects are kept by identity and never traversed; the original is unchanged.
 */
export function redactSensitive<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (typeof value !== 'object' || value === null) return value;
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => redactSensitive(item, seen)) as T;
  const copy: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(value)) {
    copy[name] = sensitiveName.test(name) ? '[redacted]' : redactSensitive(field, seen);
  }
  return copy as T;
}

function adapt(logger: PinoLogger): Logger {
  const emit = (level: 'debug' | 'info' | 'warn' | 'error') => (fields: LogFields, message?: string) => {
    if (message === undefined) logger[level](fields);
    else logger[level](fields, message);
  };
  return {
    debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error'),
    // Pino does not apply the log formatter to the bindings of a derived logger: redact them here.
    child: fields => adapt(logger.child(redactSensitive(fields))),
  };
}

/**
 * The base logger of a backend process, created once by its entry point: one JSON line per event on `stdout`,
 * events from level `warn`, the controlled `err` view and the redaction of sensitive fields.
 */
export function createBaseLogger(destination: DestinationStream = process.stdout): Logger {
  return adapt(pino({
    level: 'warn',
    // Pino copies `err.message` into `msg` when an event has no message; a key never used turns that off, so an
    // external message never reaches the line. The `err` serializer below still applies to `err`.
    errorKey: 'unusedErrorKey',
    serializers: { err: errorView },
    formatters: { log: fields => redactSensitive(fields) },
  }, destination));
}
