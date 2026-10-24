import { describe, expect, it } from 'vitest';
import { SystemCurrentTime } from './system-current-time.adapter.js';

describe('system current time', () => {
  it('provides a valid Date through the clock port', () => {
    expect(Number.isFinite(new SystemCurrentTime().now().getTime())).toBe(true);
  });
});
