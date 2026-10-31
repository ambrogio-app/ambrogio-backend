import { describe, expect, it } from 'vitest';
import { FixedCurrentTime } from './fixed-current-time.adapter.js';

describe('fixed current time', () => {
  it('provides the given instant through the clock port, unaffected by changes to the returned Date', () => {
    const instant = new Date(1_000);
    const clock = new FixedCurrentTime(instant);
    instant.setTime(2_000);
    clock.now().setTime(3_000);
    expect(clock.now().getTime()).toBe(1_000);
  });
});
