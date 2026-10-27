import { describe, expect, it } from 'vitest';
import { fromInstant, toInstant } from './postgres-turn-mapper.js';

describe('PostgreSQL conversation instants', () => {
  it('copies exact milliseconds on both sides of the Unix epoch', () => {
    for (const milliseconds of [-12_345, -1, 0, 1, 12_345]) {
      const original = new Date(milliseconds);
      const written = toInstant(original);
      const read = fromInstant(written);
      expect(read.getTime()).toBe(milliseconds);
      expect(written).not.toBe(original);
      expect(read).not.toBe(written);
    }
  });

  it('rejects absent, infinite and incompatible stored values', () => {
    // The driver reads `infinity` and `-infinity` of a timestamptz column as numbers.
    for (const value of [null, undefined, '1970-01-01T00:00:00.000Z', 0, Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY, new Date(Number.NaN)]) {
      expect(() => fromInstant(value)).toThrow('Invalid persisted instant');
    }
    expect(() => toInstant(new Date(Number.NaN))).toThrow('Invalid conversation instant');
  });
});
