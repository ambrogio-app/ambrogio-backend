import type { CurrentTime } from '../../application/turn-capabilities.port.js';

/** The current time fixed at one instant, such as the start of the process when the pending turns are recovered. */
export class FixedCurrentTime implements CurrentTime {
  readonly #instant: Date;

  constructor(instant: Date) {
    this.#instant = new Date(instant.getTime());
  }

  now(): Date {
    return new Date(this.#instant.getTime());
  }
}
