import { ProjectError } from '../project-error.js';
import type { Result } from '../domain/turn.js';
import type { BeginTurn, BeginTurnInput, BeginTurnRejection } from './begin-turn.use-case.js';
import type { CompleteTurnUseCase } from './complete-turn.use-case.js';
import type { ConversationHistory, ConversationHistoryRead } from './conversation-history-read.js';
import type { ProduceConversationReply, ReplyPart } from './produce-conversation-reply.js';

export type ExchangeTurnSuccess =
  | Readonly<{ conversationId: string; turnId: string; outcome: 'answered'; expectsReply: boolean }>
  | Readonly<{ conversationId: string; turnId: string; outcome: 'failed'; error: string;
    /** The technical failure behind the public error, for the adapter's diagnostics; never stored. */
    cause?: unknown }>
  | Readonly<{ conversationId: string; turnId: string; outcome: 'interrupted' }>;

/** Application notifications of one admitted turn, delivered one at a time in this order. */
export type ExchangeTurnObserver = Readonly<{
  admitted?(conversationId: string, turnId: string): void | Promise<void>;
  delta?(text: string): void | Promise<void>;
  /** The reply was fully produced; its outcome has not been stored yet. */
  produced?(): void | Promise<void>;
}>;

/** The longest the reply of an admitted turn may take, from the start of its production. */
export const REPLY_TIME_LIMIT_MS = 30_000;

const timedOut = Symbol('timed out');

export type ExchangeTurn = (input: BeginTurnInput, observer?: ExchangeTurnObserver,
  shouldInterrupt?: () => boolean) => Promise<Result<ExchangeTurnSuccess, BeginTurnRejection>>;

async function notify(call: (() => void | Promise<void>) | undefined): Promise<void> {
  try {
    await call?.();
  } catch { /* delivery failures do not cancel an admitted turn; adapters own diagnostics */ }
}

export function createExchangeTurn(dependencies: Readonly<{
  begin: BeginTurn;
  complete: CompleteTurnUseCase;
  history: ConversationHistoryRead;
  reply: ProduceConversationReply;
  failureMessage: string;
  /** Only tests shorten the fixed limit. */
  replyTimeLimitMs?: number;
}>): ExchangeTurn {
  const failureMessage = dependencies.failureMessage;
  const replyTimeLimitMs = dependencies.replyTimeLimitMs ?? REPLY_TIME_LIMIT_MS;
  return async (input, observer, shouldInterrupt = () => false) => {
    const admitted = await dependencies.begin(input);
    if (!admitted.ok) return admitted;
    const { conversationId, turnId } = admitted.value;
    await notify(observer?.admitted && (() => observer.admitted!(conversationId, turnId)));
    const interrupted = (): Result<ExchangeTurnSuccess, BeginTurnRejection> => ({
      ok: true, value: { conversationId, turnId, outcome: 'interrupted' },
    });
    if (shouldInterrupt()) return interrupted();

    const failAdmittedTurn = async (cause: unknown): Promise<Result<ExchangeTurnSuccess, BeginTurnRejection>> => {
      const completed = await dependencies.complete({ turnId, outcome: { kind: 'error', message: failureMessage } });
      if (!completed.ok && shouldInterrupt()) return interrupted();
      if (!completed.ok || completed.value.status !== 'failed') throw new ProjectError('Admitted turn could not be completed');
      return { ok: true, value: { conversationId, turnId, outcome: 'failed', error: failureMessage, cause } };
    };

    let history: ConversationHistory;
    try {
      const found = await dependencies.history.find(conversationId);
      if (!found || found.turns.at(-1)?.id !== turnId || found.turns.at(-1)?.status !== 'pending') {
        throw new ProjectError('Admitted turn missing from conversation history');
      }
      history = found;
    } catch (error) {
      if (shouldInterrupt()) return interrupted();
      return failAdmittedTurn(error);
    }
    if (shouldInterrupt()) return interrupted();

    let answer = '';
    let expectsReply: boolean | undefined;
    let agent: string | undefined;
    let textStarted = false;
    const limit = new ProjectError('Reply production time limit exceeded');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<typeof timedOut>(resolve => {
      timer = setTimeout(() => { controller.abort(limit); resolve(timedOut); }, replyTimeLimitMs);
    });
    let parts: AsyncIterator<ReplyPart> | undefined;
    let finished = false;
    try {
      parts = dependencies.reply.produce(history, controller.signal)[Symbol.asyncIterator]();
      for (;;) {
        const pending = parts.next();
        // A producer that fails after the limit is no longer awaited.
        pending.catch(() => { /* reported by the race unless the limit expired first */ });
        const next = await Promise.race([pending, expiry]);
        if (next === timedOut) throw limit;
        if (next.done) { finished = true; break; }
        if (shouldInterrupt()) return interrupted();
        const part = next.value;
        if (part.kind === 'agent' && agent === undefined && !textStarted && expectsReply === undefined
          && typeof part.agent === 'string' && part.agent.length > 0) {
          agent = part.agent;
        } else if (part.kind === 'text' && typeof part.text === 'string' && expectsReply === undefined) {
          if (!part.text) continue;
          textStarted = true;
          answer += part.text;
          await notify(observer?.delta && (() => observer.delta!(part.text)));
        } else if (part.kind === 'reply_expectation' && expectsReply === undefined
          && typeof part.expectsReply === 'boolean') {
          expectsReply = part.expectsReply;
        } else throw new ProjectError('Invalid reply part');
      }
      if (expectsReply === undefined) throw new ProjectError('Missing reply expectation');
    } catch (error) {
      if (shouldInterrupt()) return interrupted();
      return failAdmittedTurn(controller.signal.aborted ? limit : error);
    } finally {
      clearTimeout(timer);
      // Release a producer left mid-stream; a stalled one is abandoned to its aborted signal.
      if (!finished) void parts?.return?.(undefined)?.catch(() => { /* already failed */ });
    }
    if (shouldInterrupt()) return interrupted();
    await notify(observer?.produced && (() => observer.produced!()));

    const completed = await dependencies.complete({ turnId, outcome: { kind: 'answer', text: answer,
      ...(agent === undefined ? {} : { agent }) } });
    if (!completed.ok && shouldInterrupt()) return interrupted();
    if (!completed.ok || completed.value.status !== 'answered') throw new ProjectError('Admitted turn could not be completed');
    return { ok: true, value: { conversationId, turnId, outcome: 'answered', expectsReply } };
  };
}
