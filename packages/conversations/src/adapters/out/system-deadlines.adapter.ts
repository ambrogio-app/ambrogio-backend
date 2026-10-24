import type { Deadlines, RunningDeadline } from '../../application/turn-capabilities.port.js';

export class SystemDeadlines implements Deadlines {
  start(milliseconds: number): RunningDeadline {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const elapsed = new Promise<void>(resolve => { timer = setTimeout(resolve, milliseconds); });
    return { elapsed, cancel: () => clearTimeout(timer) };
  }
}
