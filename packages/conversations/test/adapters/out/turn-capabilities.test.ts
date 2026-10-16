import { describe, expect, it } from 'vitest';
import { UuidIdentifiers } from '../../../src/adapters/out/uuid-identifiers.adapter.js';
import { SystemCurrentTime } from '../../../src/adapters/out/system-current-time.adapter.js';

describe('technical turn capabilities', () => {
  it('provides distinct UUID v4 identities for conversations and turns', () => {
    const identifiers = new UuidIdentifiers();
    const values = Array.from({ length: 100 }, () => identifiers.next());
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('provides a valid Date through the clock port', () => {
    expect(Number.isFinite(new SystemCurrentTime().now().getTime())).toBe(true);
  });
});
