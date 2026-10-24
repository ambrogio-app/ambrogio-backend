import { describe, expect, it } from 'vitest';
import { SystemDeadlines } from './system-deadlines.adapter.js';

describe('system deadlines', () => {
  // Verification: Prova del tempo massimo della produzione della risposta
  it('elapses a deadline after its duration with the platform timer, unless cancelled', async () => {
    const deadlines = new SystemDeadlines();
    const started = Date.now();
    await deadlines.start(20).elapsed;
    expect(Date.now() - started).toBeGreaterThanOrEqual(19);
    let elapsed = false;
    const cancelled = deadlines.start(10);
    void cancelled.elapsed.then(() => { elapsed = true; });
    cancelled.cancel();
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(elapsed).toBe(false);
  });
});
