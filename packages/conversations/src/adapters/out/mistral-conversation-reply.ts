import { Mistral } from '@mistralai/mistralai';
import type { ConversationHistory } from '../../application/conversation-history-read.js';
import type { ProduceConversationReply } from '../../application/produce-conversation-reply.js';

type Message = { role: 'system' | 'user' | 'assistant'; content: string };
type StreamRequest = { model: string; messages: Message[]; temperature?: number; maxTokens?: number };
type StreamEvent = { data: { choices: Array<{ delta: { content?: unknown } }> } };
type Stream = (request: StreamRequest) => Promise<AsyncIterable<StreamEvent>>;

export type MistralAgentSettings = Readonly<{
  instructions: string;
  model: string;
  apiKey: string;
  options?: Readonly<Record<string, unknown>>;
}>;

export function mistralOptions(value: MistralAgentSettings['options']): Readonly<{
  temperature?: number; maxTokens?: number;
}> {
  if (value === undefined) return {};
  if (Object.keys(value).some((key) => key !== 'temperature' && key !== 'max_tokens')) {
    throw new Error('Unsupported Mistral option');
  }
  const temperature = value.temperature;
  const maxTokens = value.max_tokens;
  if (temperature !== undefined && (typeof temperature !== 'number'
    || !Number.isFinite(temperature) || temperature < 0)) {
    throw new Error('Invalid Mistral temperature');
  }
  if (maxTokens !== undefined && (typeof maxTokens !== 'number'
    || !Number.isSafeInteger(maxTokens) || maxTokens < 1)) {
    throw new Error('Invalid Mistral max_tokens');
  }
  return { ...(temperature === undefined ? {} : { temperature: temperature as number }),
    ...(maxTokens === undefined ? {} : { maxTokens: maxTokens as number }) };
}

export function mistralMessages(history: ConversationHistory, instructions: string): Message[] {
  const result: Message[] = [{ role: 'system', content: instructions }];
  for (const turn of history.turns) {
    result.push({ role: 'user', content: turn.text });
    if (turn.status === 'answered') result.push({ role: 'assistant', content: turn.answer });
  }
  return result;
}

export function mistralTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((part): part is { type: 'text'; text: string } =>
      part !== null && typeof part === 'object' && part.type === 'text'
      && typeof part.text === 'string').map((part) => part.text).join('');
  }
  return '';
}

/** Translate Mistral's streaming chat into the conversation reply port. */
export class MistralConversationReply implements ProduceConversationReply {
  private readonly stream: Stream;
  private readonly requestOptions: ReturnType<typeof mistralOptions>;

  constructor(private readonly settings: MistralAgentSettings, stream?: Stream) {
    if (!settings.instructions.trim() || !settings.model.trim() || !settings.apiKey.trim()) {
      throw new Error('Invalid Mistral agent configuration');
    }
    this.requestOptions = mistralOptions(settings.options);
    if (stream) this.stream = stream;
    else {
      const client = new Mistral({ apiKey: settings.apiKey });
      this.stream = (request) => client.chat.stream(request);
    }
  }

  async *produce(history: ConversationHistory): AsyncIterable<string> {
    const events = await this.stream({ model: this.settings.model,
      messages: mistralMessages(history, this.settings.instructions), ...this.requestOptions });
    for await (const event of events) {
      for (const choice of event.data.choices) {
        const text = mistralTextContent(choice.delta.content);
        if (text) yield text;
      }
    }
  }
}
