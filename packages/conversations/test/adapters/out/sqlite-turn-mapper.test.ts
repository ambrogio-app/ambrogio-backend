import { describe, expect, it } from 'vitest';
import { fromMillis, toMillis } from '../../../src/adapters/out/sqlite/sqlite-turn-mapper.js';

describe('SQLite conversation instants', () => {
  it('round trips exact milliseconds on both sides of the Unix epoch', () => {
    for (const milliseconds of [-12_345, -1, 0, 1, 12_345]) {
      expect(fromMillis(toMillis(new Date(milliseconds))).getTime()).toBe(milliseconds);
    }
  });

  it('rejects absent, fractional, incompatible and out-of-range stored values', () => {
    for (const value of [null, undefined, '0', 1.5, Number.POSITIVE_INFINITY, 8_640_000_000_000_001]) {
      expect(() => fromMillis(value)).toThrow('Invalid persisted instant');
    }
    expect(() => toMillis(new Date(Number.NaN))).toThrow('Invalid conversation instant');
  });
});
