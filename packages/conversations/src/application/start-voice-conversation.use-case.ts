import type { Result } from '../domain/turn.js';
import type { CurrentTime, NewIdentifier } from './turn-capabilities.js';

export type VoiceConversationStartRejection = Readonly<{ kind: 'occupied' | 'temporarily_unavailable' }>;

export interface VoiceConversationStartWrite {
  createWhenAvailable(id: string, createdAt: Date): Promise<Result<void, VoiceConversationStartRejection>>;
}

/** Start a fresh voice conversation before any transcript is admitted. */
export function createStartVoiceConversation(dependencies: Readonly<{
  archive: VoiceConversationStartWrite;
  identifiers: NewIdentifier;
  clock: CurrentTime;
}>) {
  return async (): Promise<Result<Readonly<{ conversationId: string }>, VoiceConversationStartRejection>> => {
    const conversationId = dependencies.identifiers.next();
    const created = await dependencies.archive.createWhenAvailable(conversationId, dependencies.clock.now());
    return created.ok ? { ok: true, value: { conversationId } } : created;
  };
}
