/** Fields of one diagnostic event, chosen explicitly at the emission point. */
export type LogFields = Readonly<Record<string, unknown>>;

/**
 * The minimal logger the inbound adapters receive from the composition root («Profilo del logger con Pino»):
 * a structural type that names no logging library.
 */
export interface Logger {
  debug(fields: LogFields, message?: string): void;
  info(fields: LogFields, message?: string): void;
  warn(fields: LogFields, message?: string): void;
  error(fields: LogFields, message?: string): void;
  /** A derived logger with fixed fields; this logger is left unchanged. */
  child(fields: LogFields): Logger;
}
