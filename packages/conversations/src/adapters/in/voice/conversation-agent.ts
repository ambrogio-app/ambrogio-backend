import { Agent, type MicdropConversationMessage } from '@micdrop/server';
import type { PassThrough } from 'node:stream';
import type { ExchangeTurn } from '../../../application/exchange-turn.use-case.js';
import type { BeginTurnRejection } from '../../../application/begin-turn.use-case.js';

export class ConversationVoiceAgent extends Agent {
  private generation = 0;
  private lastSubmitted?: MicdropConversationMessage;

  constructor(private readonly optionsForVoice: Readonly<{
    conversationId: string;
    exchange: ExchangeTurn;
    rejected(error: BeginTurnRejection): void;
    responseReady(expectsReply: boolean | undefined): void;
    shouldInterrupt(): boolean;
  }>) {
    super({ systemPrompt: '' });
  }

  override cancel(): void {
    // Micdrop cancels synthesis on interruption. An admitted exchange still
    // completes in the common archive, even if its audio is no longer delivered.
    this.generation += 1;
  }

  protected override async generateAnswer(stream: PassThrough): Promise<void> {
    const message = [...this.conversation].reverse().find(
      (item): item is MicdropConversationMessage => item.role === 'user',
    );
    if (!message || message === this.lastSubmitted || !message.content.trim()) return;
    this.lastSubmitted = message;
    const generation = this.generation;
    let spoken = '';
    const result = await this.optionsForVoice.exchange({
      text: message.content, conversationId: this.optionsForVoice.conversationId,
    }, { delta: text => {
      if (generation === this.generation && stream.writable) {
        spoken += text;
        stream.write(text);
      }
    } }, this.optionsForVoice.shouldInterrupt, true);
    if (!result.ok) {
      this.optionsForVoice.rejected(result.error);
      return;
    }
    if (generation !== this.generation) return;
    if (result.value.outcome === 'failed') {
      spoken = result.value.error;
      stream.write(spoken);
    }
    if (spoken) {
      const expectsReply = result.value.outcome === 'answered'
        ? result.value.expectsReply : false;
      this.addAssistantMessage(spoken, { expectsReply });
      this.optionsForVoice.responseReady(expectsReply);
    }
  }
}
