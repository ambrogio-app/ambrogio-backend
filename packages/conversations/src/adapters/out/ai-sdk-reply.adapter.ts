import { createMistral } from '@ai-sdk/mistral';
import { jsonSchema, Output, stepCountIs, streamText, tool, type LanguageModel, type ModelMessage } from 'ai';
import { ProjectError } from '../../project-error.js';
import type { ConversationHistory } from '../../application/conversation-history-read.js';
import type { ProduceConversationReply, ReplyPart } from '../../application/produce-conversation-reply.js';
import type { AvailableMcpTool } from './mcp-tool-client.js';

export type AgentSettings = Readonly<{
  instructions: string;
  model: string;
  apiKey: string;
  options?: Readonly<Record<string, unknown>>;
}>;

type ToolClient = { callTool(name: string, args: Record<string, unknown>): Promise<Readonly<{
  isError: boolean; content: readonly unknown[];
}>> };

export function aiSdkOptions(value?: AgentSettings['options']): Readonly<{
  temperature?: number; maxOutputTokens?: number;
}> {
  if (value === undefined) return {};
  if (Object.keys(value).some(key => key !== 'temperature' && key !== 'max_tokens')) {
    throw new ProjectError('Unsupported Mistral option');
  }
  const temperature = value.temperature;
  const maxTokens = value.max_tokens;
  if (temperature !== undefined && (typeof temperature !== 'number'
    || !Number.isFinite(temperature) || temperature < 0)) {
    throw new ProjectError('Invalid Mistral temperature');
  }
  if (maxTokens !== undefined && (typeof maxTokens !== 'number'
    || !Number.isSafeInteger(maxTokens) || maxTokens < 1)) {
    throw new ProjectError('Invalid Mistral max_tokens');
  }
  return { ...(temperature === undefined ? {} : { temperature: temperature as number }),
    ...(maxTokens === undefined ? {} : { maxOutputTokens: maxTokens as number }) };
}

function modelFor(settings: AgentSettings, model?: LanguageModel): LanguageModel {
  if (!settings.instructions.trim() || !settings.model.trim() || !settings.apiKey.trim()) {
    throw new ProjectError('Invalid agent configuration');
  }
  return model ?? createMistral({ apiKey: settings.apiKey })(settings.model);
}

function messagesFor(history: ConversationHistory): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const turn of history.turns) {
    messages.push({ role: 'user', content: turn.text });
    if (turn.status === 'answered') messages.push({ role: 'assistant', content: turn.answer });
  }
  return messages;
}

function throwStreamError(error: unknown): never {
  if (error instanceof ProjectError) throw error;
  throw new ProjectError('AI SDK response failed', { cause: error });
}

const replyOutput = Output.object({ schema: jsonSchema<{ answer: string; expectsReply: boolean }>({
  type: 'object', properties: { answer: { type: 'string' }, expectsReply: { type: 'boolean' } },
  required: ['answer', 'expectsReply'], additionalProperties: false,
}) });

function replyInstructions(instructions: string): string {
  return `${instructions}\nPut the words of your reply in answer. `
    + 'Set expectsReply to true only when the answer asks the user to reply; otherwise set it to false.';
}

async function* answerParts(response: Readonly<{
  partialOutputStream: AsyncIterable<{ answer?: unknown }>;
}>): AsyncGenerator<ReplyPart, string, void> {
  let emitted = '';
  for await (const partial of response.partialOutputStream) {
    const candidate = (partial as { answer?: unknown }).answer;
    if (typeof candidate !== 'string') continue;
    if (!candidate.startsWith(emitted)) throw new ProjectError('Answer changed during streaming');
    const delta = candidate.slice(emitted.length);
    emitted = candidate;
    if (delta) yield { kind: 'text', text: delta };
  }
  return emitted;
}

/** Emit the part of the final answer not yet streamed, then the structured reply expectation. */
async function* concludeAnswer(response: Readonly<{
  output: PromiseLike<{ answer: string; expectsReply: boolean } | undefined>;
}>, emitted: string): AsyncGenerator<ReplyPart, void, void> {
  const output = await response.output;
  if (!output || typeof output.answer !== 'string' || typeof output.expectsReply !== 'boolean') {
    throw new ProjectError('Missing reply expectation');
  }
  if (!output.answer.startsWith(emitted)) throw new ProjectError('Answer changed after streaming');
  const remaining = output.answer.slice(emitted.length);
  if (remaining) yield { kind: 'text', text: remaining };
  yield { kind: 'reply_expectation', expectsReply: output.expectsReply };
}

export class AiSdkToolAgentReply implements ProduceConversationReply {
  private readonly model: LanguageModel;
  private readonly options: ReturnType<typeof aiSdkOptions>;

  constructor(private readonly settings: AgentSettings,
    private readonly availableTools: readonly AvailableMcpTool[],
    private readonly mcp: ToolClient, private readonly maxToolCalls: number,
    model?: LanguageModel) {
    if (!Number.isSafeInteger(maxToolCalls) || maxToolCalls < 1) {
      throw new ProjectError('Invalid agent tool call limit');
    }
    this.options = aiSdkOptions(settings.options);
    this.model = modelFor(settings, model);
  }

  async *produce(history: ConversationHistory): AsyncIterable<ReplyPart> {
    let used = 0;
    // Structured output reports a failed step only as a missing object; keep the limit failure.
    let limitExceeded: ProjectError | undefined;
    const tools = Object.fromEntries(this.availableTools.map((available, index) => [
      `mcp_${index}`, tool({
        description: available.description ?? available.name,
        inputSchema: jsonSchema<Record<string, unknown>>(
          available.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: async input => {
          if (++used > this.maxToolCalls) {
            limitExceeded = new ProjectError('MCP tool call limit exceeded');
            throw limitExceeded;
          }
          return this.mcp.callTool(available.name, input);
        },
      }),
    ]));
    const response = streamText({ model: this.model, system: replyInstructions(this.settings.instructions),
      messages: messagesFor(history), tools, output: replyOutput,
      toolCallConcurrency: 1, stopWhen: stepCountIs(this.maxToolCalls + 1),
      maxRetries: 0, ...this.options });
    try {
      const emitted = yield* answerParts(response);
      yield* concludeAnswer(response, emitted);
    } catch (error) { throwStreamError(limitExceeded ?? error); }
  }
}

export type DelegatedAgent = Readonly<{ id: string; description: string;
  reply: Pick<AiSdkToolAgentReply, 'produce'> }>;

export class AiSdkOrchestratorReply implements ProduceConversationReply {
  private readonly model: LanguageModel;
  private readonly options: ReturnType<typeof aiSdkOptions>;

  constructor(private readonly settings: AgentSettings,
    private readonly specialists: readonly DelegatedAgent[], model?: LanguageModel) {
    this.options = aiSdkOptions(settings.options);
    this.model = modelFor(settings, model);
  }

  async *produce(history: ConversationHistory): AsyncIterable<ReplyPart> {
    // The function name is the agent identifier, already a valid provider function name.
    const agents = new Map(this.specialists.map(agent => [agent.id, agent]));
    const tools = Object.fromEntries([...agents].map(([name, agent]) => [name, tool({
      description: agent.description,
      // The delegation only names the agent: it has no arguments.
      inputSchema: jsonSchema<Record<string, never>>({ type: 'object', properties: {},
        additionalProperties: false }),
    })]));
    // One delegation per turn: the provider must not emit parallel delegations.
    const response = streamText({ model: this.model, system: replyInstructions(this.settings.instructions),
      messages: messagesFor(history), tools, output: replyOutput,
      providerOptions: { mistral: { parallelToolCalls: false } },
      maxRetries: 0, ...this.options });
    try {
      const emitted = yield* answerParts(response);
      const calls = await response.toolCalls;
      if (calls.length) {
        if (emitted) throw new ProjectError('Delegation after answer');
        if (calls.length !== 1) throw new ProjectError('Invalid agent delegation');
        const call = calls[0]!;
        const agent = agents.get(call.toolName);
        const input: unknown = call.input;
        if (!agent || input === null || typeof input !== 'object'
          || Array.isArray(input) || Object.keys(input).length > 0) {
          throw new ProjectError('Invalid agent delegation');
        }
        // The chosen agent answers the original turn from the stored history.
        yield* agent.reply.produce(history);
        return;
      }
      yield* concludeAnswer(response, emitted);
    } catch (error) { throwStreamError(error); }
  }
}
