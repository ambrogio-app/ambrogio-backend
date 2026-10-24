import { ProjectError } from '../domain/project-error.js';
import { ConversationId, TurnId } from '../domain/identities.js';
import type { Result } from '../domain/result.js';
import { Turn } from '../domain/turn.js';
import type { ConversationLookup } from './conversation-lookup.port.js';
import type { CurrentTime, NewIdentifier } from './turn-capabilities.port.js';
import type { AdmissionRejection, TurnRepository } from './turn-repository.port.js';

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
    case 'archive_busy': return { kind: 'temporarily_unavailable' };
    default: return assertNever(error);
  }
}

export function createBeginTurn(dependencies: Readonly<{
  turns: TurnRepository;
  conversations: ConversationLookup;
  identifiers: NewIdentifier;
  clock: CurrentTime;
}>): BeginTurn {
  return async ({ text, conversationId }) => {
    let conversation: ConversationId;
    if (conversationId === undefined) {
      conversation = ConversationId.create(dependencies.identifiers.next());
    } else {
      // A value that cannot be an identity names no stored conversation.
      if (!ConversationId.isValid(conversationId)) return { ok: false, error: { kind: 'conversation_not_found' } };
      conversation = ConversationId.create(conversationId);
      if (!await dependencies.conversations.exists(conversation)) {
        return { ok: false, error: { kind: 'conversation_not_found' } };
      }
    }
    const turn = Turn.create({
      id: TurnId.create(dependencies.identifiers.next()),
      conversationId: conversation,
      text,
      acceptedAt: dependencies.clock.now(),
    });
    const admission = await dependencies.turns.admit({
      turn, conversation: conversationId === undefined ? 'new' : 'existing',
    });
    if (!admission.ok) return { ok: false, error: projectRejection(admission.error) };
    return { ok: true, value: { conversationId: conversation.value, turnId: turn.id.value, acceptedAt: turn.acceptedAt } };
  };
}
