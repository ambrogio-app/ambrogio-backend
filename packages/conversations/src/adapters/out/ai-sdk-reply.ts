import { createMistral } from '@ai-sdk/mistral';
import { jsonSchema, Output, stepCountIs, streamText, tool, type LanguageModel, type ModelMessage } from 'ai';
import { ProjectError } from '../../project-error.js';
import type { ConversationHistory } from '../../application/conversation-history-read.js';
import type { ProduceConversationReply, VoiceReplyPart } from '../../application/produce-conversation-reply.js';
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

function messagesFor(history: ConversationHistory, task?: string): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const turn of history.turns) {
    messages.push({ role: 'user', content: turn.text });
    if (turn.status === 'answered') messages.push({ role: 'assistant', content: turn.answer });
  }
  if (task) messages.push({ role: 'user', content: task });
  return messages;
}

function throwStreamError(error: unknown): never {
  if (error instanceof ProjectError) throw error;
  throw new ProjectError('AI SDK response failed', { cause: error });
}

const voiceOutput = Output.object({ schema: jsonSchema<{ answer: string; expectsReply: boolean }>({
  type: 'object', properties: { answer: { type: 'string' }, expectsReply: { type: 'boolean' } },
  required: ['answer', 'expectsReply'], additionalProperties: false,
}) });

function voiceInstructions(instructions: string): string {
  return `${instructions}\nFor a spoken response, put the words to say in answer. `
    + 'Set expectsReply to true only when the answer asks the user to reply; otherwise set it to false.';
}

async function* voiceAnswerParts(response: Readonly<{
  partialOutputStream: AsyncIterable<{ answer?: unknown }>;
}>): AsyncGenerator<string, string, void> {
  let emitted = '';
  for await (const partial of response.partialOutputStream) {
    const candidate = (partial as { answer?: unknown }).answer;
    if (typeof candidate !== 'string') continue;
    if (!candidate.startsWith(emitted)) throw new ProjectError('Voice answer changed during streaming');
    const delta = candidate.slice(emitted.length);
    emitted = candidate;
    if (delta) yield delta;
  }
  return emitted;
}

function remainingVoiceAnswer(answer: string, emitted: string): string {
  if (!answer.startsWith(emitted)) throw new ProjectError('Voice answer changed after streaming');
  return answer.slice(emitted.length);
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

  async *produce(history: ConversationHistory, task?: string): AsyncIterable<string> {
    let used = 0;
    const tools = Object.fromEntries(this.availableTools.map((available, index) => [
      `mcp_${index}`, tool({
        description: available.description ?? available.name,
        inputSchema: jsonSchema<Record<string, unknown>>(
          available.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: async (input) => {
          if (++used > this.maxToolCalls) throw new ProjectError('MCP tool call limit exceeded');
          return this.mcp.callTool(available.name, input);
        },
      }),
    ]));
    const response = streamText({ model: this.model, system: this.settings.instructions,
      messages: messagesFor(history, task), tools,
      toolCallConcurrency: 1, stopWhen: stepCountIs(this.maxToolCalls + 1),
      maxRetries: 0, ...this.options });
    for await (const part of response.fullStream) {
      if (part.type === 'text-delta') yield part.text;
      else if (part.type === 'error' || part.type === 'tool-error') {
        throwStreamError(part.error);
      } else if (part.type === 'abort') throw new ProjectError('AI SDK response aborted');
    }
  }

  async *produceVoice(history: ConversationHistory, task?: string): AsyncIterable<VoiceReplyPart> {
    let used = 0;
    const tools = Object.fromEntries(this.availableTools.map((available, index) => [
      `mcp_${index}`, tool({
        description: available.description ?? available.name,
        inputSchema: jsonSchema<Record<string, unknown>>(
          available.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: async input => {
          if (++used > this.maxToolCalls) throw new ProjectError('MCP tool call limit exceeded');
          return this.mcp.callTool(available.name, input);
        },
      }),
    ]));
    const response = streamText({ model: this.model, system: voiceInstructions(this.settings.instructions),
      messages: messagesFor(history, task), tools, output: voiceOutput,
      toolCallConcurrency: 1, stopWhen: stepCountIs(this.maxToolCalls + 1),
      maxRetries: 0, ...this.options });
    try {
      const emitted = yield* voiceAnswerParts(response);
      const output = await response.output;
      if (!output || typeof output.expectsReply !== 'boolean') {
        throw new ProjectError('Missing voice reply expectation');
      }
      const remaining = remainingVoiceAnswer(output.answer, emitted);
      if (remaining) yield remaining;
      yield { kind: 'reply_expectation', expectsReply: output.expectsReply };
    } catch (error) { throwStreamError(error); }
  }
}

export type DelegatedAgent = Readonly<{ id: string; description: string;
  reply: Pick<AiSdkToolAgentReply, 'produce'> & Partial<Pick<AiSdkToolAgentReply, 'produceVoice'>> }>;

export class AiSdkOrchestratorReply implements ProduceConversationReply {
  private readonly model: LanguageModel;
  private readonly options: ReturnType<typeof aiSdkOptions>;

  constructor(private readonly settings: AgentSettings,
    private readonly specialists: readonly DelegatedAgent[], model?: LanguageModel) {
    this.options = aiSdkOptions(settings.options);
    this.model = modelFor(settings, model);
  }

  async *produce(history: ConversationHistory): AsyncIterable<string> {
    const agents = new Map(this.specialists.map((agent, index) => [`delegate_${index}`, agent]));
    const tools = Object.fromEntries([...agents].map(([name, agent]) => [name, tool({
      description: agent.description,
      inputSchema: jsonSchema<{ task: string }>({ type: 'object',
        properties: { task: { type: 'string' } }, required: ['task'], additionalProperties: false }),
    })]));
    const response = streamText({ model: this.model, system: this.settings.instructions,
      messages: messagesFor(history), tools, maxRetries: 0, ...this.options });
    let selected: { agent: DelegatedAgent; task: string } | undefined;
    let emittedText = false;
    for await (const part of response.fullStream) {
      if (part.type === 'text-delta') {
        emittedText = true;
        yield part.text;
      } else if (part.type === 'tool-call') {
        if (selected || emittedText) throw new ProjectError('Invalid agent delegation');
        const agent = agents.get(part.toolName);
        const input: unknown = part.input;
        if (!agent || input === null || typeof input !== 'object' || Array.isArray(input)
          || typeof (input as { task?: unknown }).task !== 'string'
          || !(input as { task: string }).task.trim()
          || Object.keys(input).some(key => key !== 'task')) {
          throw new ProjectError('Invalid agent delegation');
        }
        selected = { agent, task: (input as { task: string }).task };
      } else if (part.type === 'error' || part.type === 'tool-error') {
        throwStreamError(part.error);
      } else if (part.type === 'abort') throw new ProjectError('AI SDK response aborted');
    }
    if (selected) yield* selected.agent.reply.produce(history, selected.task);
  }

  async *produceVoice(history: ConversationHistory): AsyncIterable<VoiceReplyPart> {
    const agents = new Map(this.specialists.map((agent, index) => [`delegate_${index}`, agent]));
    const tools = Object.fromEntries([...agents].map(([name, agent]) => [name, tool({
      description: agent.description,
      inputSchema: jsonSchema<{ task: string }>({ type: 'object',
        properties: { task: { type: 'string' } }, required: ['task'], additionalProperties: false }),
    })]));
    const response = streamText({ model: this.model, system: voiceInstructions(this.settings.instructions),
      messages: messagesFor(history), tools, output: voiceOutput,
      maxRetries: 0, ...this.options });
    try {
      const emitted = yield* voiceAnswerParts(response);
      const calls = await response.toolCalls;
      if (calls.length) {
        if (emitted) throw new ProjectError('Delegation after spoken answer');
        if (calls.length !== 1) throw new ProjectError('Invalid agent delegation');
        const call = calls[0]!;
        const agent = agents.get(call.toolName);
        const input: unknown = call.input;
        if (!agent || !agent.reply.produceVoice || input === null || typeof input !== 'object'
          || Array.isArray(input) || typeof (input as { task?: unknown }).task !== 'string'
          || !(input as { task: string }).task.trim()
          || Object.keys(input).some(key => key !== 'task')) {
          throw new ProjectError('Invalid agent delegation');
        }
        yield* agent.reply.produceVoice(history, (input as { task: string }).task);
        return;
      }
      const output = await response.output;
      if (!output || typeof output.expectsReply !== 'boolean') {
        throw new ProjectError('Missing voice reply expectation');
      }
      const remaining = remainingVoiceAnswer(output.answer, emitted);
      if (remaining) yield remaining;
      yield { kind: 'reply_expectation', expectsReply: output.expectsReply };
    } catch (error) { throwStreamError(error); }
  }
}
