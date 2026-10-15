import type { CurrentTime } from '../../application/turn-capabilities.js';

export class SystemCurrentTime implements CurrentTime {
  now(): Date {
    return new Date();
  }
}
