export interface NewIdentifier {
  next(): string;
}

export interface CurrentTime {
  now(): Date;
}

/** A started time limit: `elapsed` resolves when it expires, unless it is cancelled first. */
export type RunningDeadline = Readonly<{ elapsed: Promise<void>; cancel(): void }>;

/** Measures time limits with the platform timer, which Application does not use directly. */
export interface Deadlines {
  start(milliseconds: number): RunningDeadline;
}
