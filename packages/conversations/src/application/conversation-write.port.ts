import type { Result, Turn, TurnSnapshot } from '../domain/turn.js';

export type ConversationOccupied = Readonly<{ kind: 'conversation_occupied' }>;
export type ConversationMissing = Readonly<{ kind: 'conversation_missing' }>;
export type ArchiveBusy = Readonly<{ kind: 'archive_busy' }>;
export type AdmissionRejection = ConversationOccupied | ConversationMissing | ArchiveBusy;
export type TurnNotActive = Readonly<{ kind: 'turn_not_active' }>;

export type AdmitTurn = Readonly<{
  conversationId: string;
  createConversation: boolean;
  turn: Turn;
}>;

export type CompleteTurn = Readonly<{
  turnId: string;
  outcome:
    | Readonly<{ kind: 'answer'; text: string; agent?: string }>
    | Readonly<{ kind: 'error'; message: string }>
    | Readonly<{ kind: 'interrupted' }>;
  finishedAt: Date;
}>;

/** The archive owns atomic admission and completion for each conversation. */
export interface ConversationWrite {
  admit(input: AdmitTurn): Promise<Result<void, AdmissionRejection>>;
  complete(input: CompleteTurn): Promise<Result<TurnSnapshot, TurnNotActive>>;
}
