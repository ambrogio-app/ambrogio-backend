import type { CurrentTime } from '../turn-capabilities.port.js';
import type { TurnRepository } from '../turn-repository.port.js';

/** Interrupts every turn still pending and returns how many interruptions were saved. */
export type InterruptPendingTurns = () => Promise<number>;

/**
 * At startup, after the migrations and before any ingress, and at shutdown, after the ingresses stop:
 * each pending turn is loaded, interrupted through the Root and saved with the release of its
 * conversation. A turn concluded meanwhile keeps its outcome.
 */
export function createInterruptPendingTurns(dependencies: Readonly<{
  turns: TurnRepository;
  clock: CurrentTime;
}>): InterruptPendingTurns {
  return async () => {
    const finishedAt = dependencies.clock.now();
    let interrupted = 0;
    for (const turn of await dependencies.turns.findPending()) {
      if (!turn.interrupt(finishedAt).ok) continue;
      const saved = await dependencies.turns.saveConclusion(turn);
      if (saved.ok) interrupted += 1;
    }
    return interrupted;
  };
}
