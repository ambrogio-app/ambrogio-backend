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

export type ErrorView = Readonly<{ type: string; message: string; stack: string; faults?: readonly ErrorView[];
  errors?: readonly ErrorView[] }>;

/** The constant description of every error not built by the backend and of every unknown thrown value. */
const opaqueMessage = 'Unexpected backend failure';

/** The views built here, so that a view met again, for example by the `err` serializer, is kept as it is. */
const views = new WeakSet<object>();

function registered(view: ErrorView): ErrorView {
  views.add(view);
  return view;
}

/**
 * The controlled `err` view («Profilo controllato di serializzazione di err»): project errors show type, message
 * and stack, a lifecycle error also the views of the faults it collects; an external `AggregateError` shows a
 * constant description and the views of its errors; anything else stays opaque. The view is a new object and the
 * cause chain is not serialized.
 */
export function errorView(value: unknown): ErrorView {
  if (typeof value === 'object' && value !== null && views.has(value)) return value as ErrorView;
  if (value instanceof ProjectError) {
    const view = { type: value.name, message: value.message, stack: value.stack ?? '' };
    return registered(value instanceof LifecycleError ? { ...view, faults: value.faults.map(errorView) } : view);
  }
  if (value instanceof AggregateError) {
    const errors: unknown[] = Array.isArray(value.errors) ? value.errors : [];
    return registered({ type: 'AggregateError', message: opaqueMessage, stack: '[redacted]',
      errors: errors.map(errorView) });
  }
  return registered({ type: 'Error', message: opaqueMessage, stack: '[redacted]' });
}

const sensitiveName = /token|password|passwd|secret|authorization|cookie|credential|api[-_]?key/i;

/**
 * A copy of `value` for a log line: every `Error`, at any depth and under any key, becomes its controlled view, and
 * the value of every field with a sensitive name is `[redacted]`, in plain objects, arrays and the own enumerable data
 * fields of class instances (getters are not invoked). An object referenced more than once or circularly has one copy,
 * redacted in every occurrence; dates are kept. The originals are never changed.
 */
export function redactSensitive<T>(value: T, copies: WeakMap<object, unknown> = new WeakMap()): T {
  if (typeof value !== 'object' || value === null) return value;
  if (value instanceof Error || views.has(value)) return errorView(value) as T;
  if (value instanceof Date) return value;
  if (copies.has(value)) return copies.get(value) as T;
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    copies.set(value, copy);
    for (const item of value) copy.push(redactSensitive(item, copies));
    return copy as T;
  }
  const copy: Record<string, unknown> = {};
  copies.set(value, copy);
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!descriptor.enumerable || !('value' in descriptor)) continue;
    copy[name] = sensitiveName.test(name) ? '[redacted]' : redactSensitive(descriptor.value, copies);
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
 * events from level `info`, the controlled `err` view and the redaction of sensitive fields.
 */
export function createBaseLogger(destination: DestinationStream = process.stdout): Logger {
  return adapt(pino({
    level: 'info',
    // Pino copies `err.message` into `msg` when an event has no message; a key never used turns that off, so an
    // external message never reaches the line. The `err` serializer below still applies to `err`.
    errorKey: 'unusedErrorKey',
    serializers: { err: errorView },
    formatters: { log: fields => redactSensitive(fields) },
  }, destination));
}
