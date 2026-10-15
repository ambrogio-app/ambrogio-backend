import type { Result } from '../domain/turn.js';
import type { BeginTurn, BeginTurnInput, BeginTurnRejection } from './begin-turn.use-case.js';
import type { CompleteTurnUseCase } from './complete-turn.use-case.js';
import type { ConversationHistory, ConversationHistoryRead } from './conversation-history-read.js';
import type { ProduceConversationReply } from './produce-conversation-reply.js';

export type ExchangeTurnSuccess =
  | Readonly<{ conversationId: string; turnId: string; outcome: 'answered' }>
  | Readonly<{ conversationId: string; turnId: string; outcome: 'failed'; error: string }>;
export type ExchangeTurn = (input: BeginTurnInput, observer?: Readonly<{
  admitted?(conversationId: string, turnId: string): void | Promise<void>;
  delta?(text: string): void | Promise<void>;
}>) => Promise<Result<ExchangeTurnSuccess, BeginTurnRejection>>;

async function notify(call: (() => void | Promise<void>) | undefined): Promise<void> {
  try {
    await call?.();
  } catch { /* a disconnected observer cannot cancel an admitted turn */ }
}

export function createExchangeTurn(dependencies: Readonly<{
  begin: BeginTurn;
  complete: CompleteTurnUseCase;
  history: ConversationHistoryRead;
  reply: ProduceConversationReply;
  failureMessage: string;
}>): ExchangeTurn {
  const failureMessage = dependencies.failureMessage;
  return async (input, observer) => {
    const admitted = await dependencies.begin(input);
    if (!admitted.ok) return admitted;
    const { conversationId, turnId } = admitted.value;
    await notify(observer?.admitted && (() => observer.admitted!(conversationId, turnId)));

    const failAdmittedTurn = async (): Promise<Result<ExchangeTurnSuccess, BeginTurnRejection>> => {
      const completed = await dependencies.complete({ turnId, outcome: { kind: 'error', message: failureMessage } });
      if (!completed.ok || completed.value.status !== 'failed') throw new Error('Admitted turn could not be completed');
      return { ok: true, value: { conversationId, turnId, outcome: 'failed', error: failureMessage } };
    };

    let history: ConversationHistory;
    try {
      const found = await dependencies.history.find(conversationId);
      if (!found || found.turns.at(-1)?.id !== turnId || found.turns.at(-1)?.status !== 'pending') {
        throw new Error('Admitted turn missing from conversation history');
      }
      history = found;
    } catch {
      return failAdmittedTurn();
    }

    let answer = '';
    try {
      for await (const text of dependencies.reply.produce(history)) {
        answer += text;
        await notify(observer?.delta && (() => observer.delta!(text)));
      }
    } catch {
      return failAdmittedTurn();
    }

    const completed = await dependencies.complete({ turnId, outcome: { kind: 'answer', text: answer } });
    if (!completed.ok || completed.value.status !== 'answered') throw new Error('Admitted turn could not be completed');
    return { ok: true, value: { conversationId, turnId, outcome: 'answered' } };
  };
}
