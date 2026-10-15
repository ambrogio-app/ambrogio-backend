import type { Result } from '../domain/turn.js';
import type { CompleteTurn, ConversationWrite, TurnNotActive } from './conversation-write.js';
import type { CurrentTime } from './turn-capabilities.js';

export type CompleteTurnInput = Readonly<{ turnId: string; outcome: CompleteTurn['outcome'] }>;
export type CompleteTurnSuccess = Readonly<{ turnId: string; status: 'answered' | 'failed' | 'interrupted' }>;
export type CompleteTurnRejection = Readonly<{ kind: 'turn_not_active' }>;
export type CompleteTurnUseCase = (input: CompleteTurnInput) => Promise<Result<CompleteTurnSuccess, CompleteTurnRejection>>;

function projectRejection(error: TurnNotActive): CompleteTurnRejection {
  return { kind: error.kind };
}

export function createCompleteTurn(dependencies: Readonly<{
  archive: ConversationWrite;
  clock: CurrentTime;
}>): CompleteTurnUseCase {
  return async ({ turnId, outcome }) => {
    const result = await dependencies.archive.complete({ turnId, outcome, finishedAt: dependencies.clock.now() });
    if (!result.ok) return { ok: false, error: projectRejection(result.error) };
    const status = result.value.status;
    if (status === 'pending') throw new Error('Archive reported an unfinished turn');
    return { ok: true, value: { turnId, status } };
  };
}
