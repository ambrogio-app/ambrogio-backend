import { ProjectError } from '../project-error.js';
import { TurnId } from '../domain/identities.js';
import type { Result } from '../domain/result.js';
import type { Turn, TurnTransitionRejected } from '../domain/turn.js';
import type { CurrentTime } from './turn-capabilities.port.js';
import type { TurnRepository } from './turn-repository.port.js';

export type CompleteTurnOutcome =
  | Readonly<{ kind: 'answer'; text: string; agent?: string }>
  | Readonly<{ kind: 'error'; message: string }>
  | Readonly<{ kind: 'interrupted' }>;
export type CompleteTurnInput = Readonly<{ turnId: string; outcome: CompleteTurnOutcome }>;
export type CompleteTurnSuccess = Readonly<{ turnId: string; status: 'answered' | 'failed' | 'interrupted' }>;
export type CompleteTurnRejection = Readonly<{ kind: 'turn_already_closed' }>;
export type CompleteTurnUseCase = (input: CompleteTurnInput) => Promise<Result<CompleteTurnSuccess, CompleteTurnRejection>>;

function assertNever(value: never): never {
  throw new ProjectError('Unhandled turn outcome');
}

function conclude(turn: Turn, outcome: CompleteTurnOutcome, finishedAt: Date): Result<void, TurnTransitionRejected> {
  switch (outcome.kind) {
    case 'answer': return turn.answer(outcome.text, finishedAt, outcome.agent);
    case 'error': return turn.fail(outcome.message, finishedAt);
    case 'interrupted': return turn.interrupt(finishedAt);
    default: return assertNever(outcome);
  }
}

/** Loads the turn, concludes it through the Root and saves it; a closed turn is an expected outcome. */
export function createCompleteTurn(dependencies: Readonly<{
  turns: TurnRepository;
  clock: CurrentTime;
}>): CompleteTurnUseCase {
  return async ({ turnId, outcome }) => {
    const turn = await dependencies.turns.find(TurnId.create(turnId));
    if (!turn) throw new ProjectError('Admitted turn missing from the archive');
    const transition = conclude(turn, outcome, dependencies.clock.now());
    if (!transition.ok) return { ok: false, error: { kind: 'turn_already_closed' } };
    const saved = await dependencies.turns.saveConclusion(turn);
    if (!saved.ok) return { ok: false, error: { kind: saved.error.kind } };
    const status = turn.status;
    if (status === 'pending') throw new ProjectError('Turn conclusion did not finish');
    return { ok: true, value: { turnId, status } };
  };
}
