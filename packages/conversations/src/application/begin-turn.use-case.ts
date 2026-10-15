import { ProjectError } from '../project-error.js';
import { Turn, type Result } from '../domain/turn.js';
import type { AdmissionRejection, ConversationWrite } from './conversation-write.js';
import type { CurrentTime, NewIdentifier } from './turn-capabilities.js';

export type BeginTurnInput = Readonly<{ text: string; conversationId?: string }>;
export type BeginTurnSuccess = Readonly<{ conversationId: string; turnId: string; acceptedAt: Date }>;
export type BeginTurnOccupied = Readonly<{ kind: 'occupied' }>;
export type BeginTurnConversationMissing = Readonly<{ kind: 'conversation_not_found' }>;
export type BeginTurnUnavailable = Readonly<{ kind: 'temporarily_unavailable' }>;
export type BeginTurnRejection = BeginTurnOccupied | BeginTurnConversationMissing | BeginTurnUnavailable;
export type BeginTurn = (input: BeginTurnInput) => Promise<Result<BeginTurnSuccess, BeginTurnRejection>>;

function assertNever(value: never): never {
  throw new ProjectError('Unhandled admission rejection');
}

function projectRejection(error: AdmissionRejection): BeginTurnRejection {
  switch (error.kind) {
    case 'conversation_occupied': return { kind: 'occupied' };
    case 'conversation_missing': return { kind: 'conversation_not_found' };
    case 'archive_busy': return { kind: 'temporarily_unavailable' };
    default: return assertNever(error);
  }
}

export function createBeginTurn(dependencies: Readonly<{
  archive: ConversationWrite;
  identifiers: NewIdentifier;
  clock: CurrentTime;
}>): BeginTurn {
  return async ({ text, conversationId }) => {
    const id = conversationId ?? dependencies.identifiers.next();
    const turnId = dependencies.identifiers.next();
    const turn = Turn.accept({ id: turnId, text, acceptedAt: dependencies.clock.now() });
    const admission = await dependencies.archive.admit({
      conversationId: id,
      createConversation: conversationId === undefined,
      turn,
    });
    if (!admission.ok) return { ok: false, error: projectRejection(admission.error) };
    return { ok: true, value: { conversationId: id, turnId, acceptedAt: turn.snapshot().acceptedAt } };
  };
}
