import type { ConversationId } from '../domain/identities.js';

/** An auxiliary fact for commands: whether a conversation exists. Conversations are never removed. */
export interface ConversationLookup {
  exists(id: ConversationId): Promise<boolean>;
}
