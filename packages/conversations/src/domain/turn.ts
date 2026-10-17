import { ProjectError } from '../project-error.js';
export type TurnTransitionRejected = Readonly<{ kind: 'already_closed' }>;

export type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

type Base = Readonly<{ id: string; text: string; acceptedAt: Date }>;

export type TurnSnapshot =
  | (Base & Readonly<{ status: 'pending' }>)
  | (Base & Readonly<{ status: 'answered'; answer: string; finishedAt: Date;
    /** The agent that formulated the answer, when known. */
    agent?: string }>)
  | (Base & Readonly<{ status: 'failed'; error: string; finishedAt: Date }>)
  | (Base & Readonly<{ status: 'interrupted'; finishedAt: Date }>);

function copyDate(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ProjectError('Invalid conversation instant');
  }
  return new Date(value.getTime());
}

function checkAgent(agent: unknown): Readonly<{ agent?: string }> {
  if (agent === undefined) return {};
  if (typeof agent !== 'string' || agent.length === 0) throw new ProjectError('Invalid responding agent');
  return { agent };
}

function checkBase(value: Base): Base {
  if (typeof value.id !== 'string' || value.id.length === 0) throw new ProjectError('Invalid turn identity');
  if (typeof value.text !== 'string' || value.text.trim().length === 0) throw new ProjectError('Invalid turn text');
  return { id: value.id, text: value.text, acceptedAt: copyDate(value.acceptedAt) };
}

function copySnapshot(value: TurnSnapshot): TurnSnapshot {
  const base = checkBase(value);
  switch (value.status) {
    case 'pending':
      if ('finishedAt' in value || 'answer' in value || 'error' in value || 'agent' in value) break;
      return { ...base, status: 'pending' };
    case 'answered':
      if (typeof value.answer !== 'string' || 'error' in value) break;
      return { ...base, status: 'answered', answer: value.answer, finishedAt: copyDate(value.finishedAt),
        ...checkAgent(value.agent) };
    case 'failed':
      if (typeof value.error !== 'string' || 'answer' in value || 'agent' in value) break;
      return { ...base, status: 'failed', error: value.error, finishedAt: copyDate(value.finishedAt) };
    case 'interrupted':
      if ('answer' in value || 'error' in value || 'agent' in value) break;
      return { ...base, status: 'interrupted', finishedAt: copyDate(value.finishedAt) };
  }
  throw new ProjectError('Invalid persisted turn state');
}

/** The state of one accepted turn. Installation-wide admission belongs to the archive. */
export class Turn {
  private constructor(private state: TurnSnapshot) {}

  static accept(value: Base): Turn {
    return new Turn({ ...checkBase(value), status: 'pending' });
  }

  static restore(value: TurnSnapshot): Turn {
    return new Turn(copySnapshot(value));
  }

  snapshot(): TurnSnapshot {
    return copySnapshot(this.state);
  }

  answer(answer: string, finishedAt: Date, agent?: string): Result<void, TurnTransitionRejected> {
    if (this.state.status !== 'pending') return { ok: false, error: { kind: 'already_closed' } };
    if (typeof answer !== 'string') throw new ProjectError('Invalid turn answer');
    const responder = checkAgent(agent);
    const instant = copyDate(finishedAt);
    this.state = { ...this.state, status: 'answered', answer, finishedAt: instant, ...responder };
    return { ok: true, value: undefined };
  }

  fail(error: string, finishedAt: Date): Result<void, TurnTransitionRejected> {
    if (this.state.status !== 'pending') return { ok: false, error: { kind: 'already_closed' } };
    if (typeof error !== 'string' || error.length === 0) throw new ProjectError('Invalid public error');
    const instant = copyDate(finishedAt);
    this.state = { ...this.state, status: 'failed', error, finishedAt: instant };
    return { ok: true, value: undefined };
  }

  interrupt(finishedAt: Date): Result<void, TurnTransitionRejected> {
    if (this.state.status !== 'pending') return { ok: false, error: { kind: 'already_closed' } };
    const instant = copyDate(finishedAt);
    this.state = { ...this.state, status: 'interrupted', finishedAt: instant };
    return { ok: true, value: undefined };
  }
}
