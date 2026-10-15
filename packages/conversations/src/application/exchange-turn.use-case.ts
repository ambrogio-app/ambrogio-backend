import type { Result } from '../domain/turn.js';
import type { BeginTurn, BeginTurnInput, BeginTurnRejection } from './begin-turn.use-case.js';
import type { CompleteTurnUseCase } from './complete-turn.use-case.js';
import type { ConversationHistoryRead } from './conversation-history-read.js';
import type { ProduceConversationReply } from './produce-conversation-reply.js';

export type ExchangeTurnSuccess =
  | Readonly<{ conversationId: string; turnId: string; outcome: 'answered' }>
  | Readonly<{ conversationId: string; turnId: string; outcome: 'failed'; error: string }>;
export type ExchangeTurn = (input: BeginTurnInput, observer?: Readonly<{
  admitted?(conversationId: string, turnId: string): void | Promise<void>;
  delta?(text: string): void | Promise<void>;
}>) => Promise<Result<ExchangeTurnSuccess, BeginTurnRejection>>;

const publicFailure = 'Non riesco a completare la risposta.';

function notify(call: (() => void | Promise<void>) | undefined): void {
  try {
    void Promise.resolve(call?.()).catch(() => { /* a disconnected observer cannot cancel a turn */ });
  } catch { /* a disconnected observer cannot cancel an admitted turn */ }
}

export function createExchangeTurn(dependencies: Readonly<{
  begin: BeginTurn;
  complete: CompleteTurnUseCase;
  history: ConversationHistoryRead;
  reply: ProduceConversationReply;
}>): ExchangeTurn {
  return async (input, observer) => {
    const admitted = await dependencies.begin(input);
    if (!admitted.ok) return admitted;
    const { conversationId, turnId } = admitted.value;
    notify(observer?.admitted && (() => observer.admitted!(conversationId, turnId)));

    // A read failure is an archive fault, not a failed conversational reply.
    // Leave its pending turn for startup recovery if the archive cannot complete it.
    const history = await dependencies.history.find(conversationId);
    if (!history || history.turns.at(-1)?.id !== turnId || history.turns.at(-1)?.status !== 'pending') {
      throw new Error('Admitted turn missing from conversation history');
    }

    let answer = '';
    try {
      for await (const text of dependencies.reply.produce(history)) {
        answer += text;
        notify(observer?.delta && (() => observer.delta!(text)));
      }
    } catch {
      const completed = await dependencies.complete({ turnId, outcome: { kind: 'error', message: publicFailure } });
      if (!completed.ok || completed.value.status !== 'failed') throw new Error('Admitted turn could not be completed');
      return { ok: true, value: { conversationId, turnId, outcome: 'failed', error: publicFailure } };
    }

    const completed = await dependencies.complete({ turnId, outcome: { kind: 'answer', text: answer } });
    if (!completed.ok || completed.value.status !== 'answered') throw new Error('Admitted turn could not be completed');
    return { ok: true, value: { conversationId, turnId, outcome: 'answered' } };
  };
}
