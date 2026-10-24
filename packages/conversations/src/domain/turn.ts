import { ProjectError } from './project-error.js';
import { ConversationId, TurnId } from './identities.js';
import type { Result } from './result.js';

export type TurnTransitionRejected = Readonly<{ kind: 'already_closed' }>;

export type TurnStatus = 'pending' | 'answered' | 'failed' | 'interrupted';

/** What the Application supplies to the birth of a turn: identities and instant are never chosen here. */
export type NewTurn = Readonly<{ id: TurnId; conversationId: ConversationId; text: string; acceptedAt: Date }>;

/** The saved state of a turn, as rebuilt by persistence. */
export type SavedTurn =
  | (NewTurn & Readonly<{ status: 'pending' }>)
  | (NewTurn & Readonly<{ status: 'answered'; answer: string; finishedAt: Date; agent?: string }>)
  | (NewTurn & Readonly<{ status: 'failed'; error: string; finishedAt: Date }>)
  | (NewTurn & Readonly<{ status: 'interrupted'; finishedAt: Date }>);

function copyDate(value: unknown): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ProjectError('Invalid conversation instant');
  }
  return new Date(value.getTime());
}

function checkAgent(agent: unknown): string | undefined {
  if (agent === undefined) return undefined;
  if (typeof agent !== 'string' || agent.length === 0) throw new ProjectError('Invalid responding agent');
  return agent;
}

function checkBirth(value: NewTurn): NewTurn {
  if (!(value.id instanceof TurnId)) throw new ProjectError('Invalid turn identity');
  if (!(value.conversationId instanceof ConversationId)) throw new ProjectError('Invalid conversation identity');
  if (typeof value.text !== 'string' || value.text.trim().length === 0) throw new ProjectError('Invalid turn text');
  return { id: value.id, conversationId: value.conversationId, text: value.text, acceptedAt: copyDate(value.acceptedAt) };
}

type Outcome = Readonly<{ answer?: string; error?: string; agent?: string; finishedAt?: Date }>;

function checkOutcome(value: SavedTurn): Outcome {
  const fields = value as Partial<Record<'answer' | 'error' | 'agent' | 'finishedAt', unknown>>;
  switch (value.status) {
    case 'pending':
      if (fields.finishedAt !== undefined || fields.answer !== undefined || fields.error !== undefined
        || fields.agent !== undefined) break;
      return {};
    case 'answered': {
      if (typeof fields.answer !== 'string' || fields.error !== undefined) break;
      const agent = checkAgent(fields.agent);
      return { answer: fields.answer, finishedAt: copyDate(fields.finishedAt), ...(agent === undefined ? {} : { agent }) };
    }
    case 'failed':
      if (typeof fields.error !== 'string' || fields.answer !== undefined
        || fields.agent !== undefined) break;
      return { error: fields.error, finishedAt: copyDate(fields.finishedAt) };
    case 'interrupted':
      if (fields.answer !== undefined || fields.error !== undefined || fields.agent !== undefined) break;
      return { finishedAt: copyDate(fields.finishedAt) };
  }
  throw new ProjectError('Invalid persisted turn state');
}

/**
 * The Root of the turn aggregate. It changes only through `answer`, `fail` and `interrupt`; the single
 * active turn per conversation is not a Domain rule: the archive guarantees it.
 */
export class Turn {
  readonly #id: TurnId;
  readonly #conversationId: ConversationId;
  readonly #text: string;
  readonly #acceptedAt: Date;
  #status: TurnStatus;
  #answer: string | undefined;
  #error: string | undefined;
  #agent: string | undefined;
  #finishedAt: Date | undefined;

  private constructor(birth: NewTurn, status: TurnStatus, outcome: Outcome) {
    this.#id = birth.id;
    this.#conversationId = birth.conversationId;
    this.#text = birth.text;
    this.#acceptedAt = birth.acceptedAt;
    this.#status = status;
    this.#answer = outcome.answer;
    this.#error = outcome.error;
    this.#agent = outcome.agent;
    this.#finishedAt = outcome.finishedAt;
  }

  /** The birth of an accepted turn: always pending, with the values supplied by the Application. */
  static create(input: NewTurn): Turn {
    return new Turn(checkBirth(input), 'pending', {});
  }

  /** Restores a saved turn, checking the current invariants without replaying its transitions. */
  static rehydrate(state: SavedTurn): Turn {
    const status: unknown = state.status;
    if (status !== 'pending' && status !== 'answered' && status !== 'failed' && status !== 'interrupted') {
      throw new ProjectError('Invalid persisted turn state');
    }
    return new Turn(checkBirth(state), state.status, checkOutcome(state));
  }

  get id(): TurnId { return this.#id; }
  get conversationId(): ConversationId { return this.#conversationId; }
  get text(): string { return this.#text; }
  get acceptedAt(): Date { return new Date(this.#acceptedAt.getTime()); }
  get status(): TurnStatus { return this.#status; }
  get answerText(): string | undefined { return this.#answer; }
  get errorMessage(): string | undefined { return this.#error; }
  /** The agent that formulated the answer, when known. */
  get respondingAgent(): string | undefined { return this.#agent; }
  get finishedAt(): Date | undefined {
    return this.#finishedAt === undefined ? undefined : new Date(this.#finishedAt.getTime());
  }

  answer(answer: string, finishedAt: Date, agent?: string): Result<void, TurnTransitionRejected> {
    if (this.#status !== 'pending') return { ok: false, error: { kind: 'already_closed' } };
    if (typeof answer !== 'string') throw new ProjectError('Invalid turn answer');
    const responder = checkAgent(agent);
    const instant = copyDate(finishedAt);
    this.#status = 'answered';
    this.#answer = answer;
    this.#agent = responder;
    this.#finishedAt = instant;
    return { ok: true, value: undefined };
  }

  fail(error: string, finishedAt: Date): Result<void, TurnTransitionRejected> {
    if (this.#status !== 'pending') return { ok: false, error: { kind: 'already_closed' } };
    if (typeof error !== 'string' || error.length === 0) throw new ProjectError('Invalid public error');
    const instant = copyDate(finishedAt);
    this.#status = 'failed';
    this.#error = error;
    this.#finishedAt = instant;
    return { ok: true, value: undefined };
  }

  interrupt(finishedAt: Date): Result<void, TurnTransitionRejected> {
    if (this.#status !== 'pending') return { ok: false, error: { kind: 'already_closed' } };
    const instant = copyDate(finishedAt);
    this.#status = 'interrupted';
    this.#finishedAt = instant;
    return { ok: true, value: undefined };
  }
}
