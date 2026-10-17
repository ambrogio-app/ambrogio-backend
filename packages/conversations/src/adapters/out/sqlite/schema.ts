import type { Generated } from 'kysely';

export interface ConversationRows {
  id: string;
  created_at: number;
  last_activity_at: number;
  active_turn_id: Generated<string | null>;
}

export interface TurnRows {
  id: string;
  conversation_id: string;
  ordinal: number;
  text: string;
  accepted_at: number;
  status: 'pending' | 'answered' | 'failed' | 'interrupted';
  answer: string | null;
  error: string | null;
  finished_at: number | null;
  agent: Generated<string | null>;
}

export interface InstallationRows {
  id: number;
  active_turn_id: string | null;
}

export interface ConversationDatabase {
  conversations: ConversationRows;
  turns: TurnRows;
  installation: InstallationRows;
}
