import { createMistral } from '@ai-sdk/mistral';
import { generateText, jsonSchema, Output, stepCountIs, streamText, tool, type LanguageModel,
  type ModelMessage } from 'ai';
import { ProjectError } from '../../project-error.js';
import type { ConversationHistory } from '../../application/conversation-history-read.js';
import type { ProduceConversationReply, ReplyCancellation, ReplyPart }
  from '../../application/produce-conversation-reply.js';
import type { AvailableMcpTool } from './mcp-tool-client.js';

export type AgentSettings = Readonly<{
  instructions: string;
  model: string;
  apiKey: string;
  options?: Readonly<Record<string, unknown>>;
}>;

type ToolClient = {
  callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<Readonly<{
    isError: boolean; content: readonly unknown[];
  }>>;
  getPrompt(name: string, signal?: AbortSignal): Promise<string>;
};

/** What the agent's MCP server offered at startup: its tools and the prompts without required arguments. */
export type DiscoveredMcp = Readonly<{ tools: readonly AvailableMcpTool[]; prompts: readonly string[] }>;

/** The MCP name when the provider accepts it; otherwise the reserved positional name. */
function presentedToolName(name: string, index: number): string {
  return /^[A-Za-z0-9_-]{1,64}$/.test(name) && !/^mcp_\d+$/.test(name) ? name : `mcp_${index}`;
}

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

/** The stored conversation; only the router sees which agent gave each answer. */
function messagesFor(history: ConversationHistory, showAgents = false): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const turn of history.turns) {
    messages.push({ role: 'user', content: turn.text });
    if (turn.status !== 'answered') continue;
    const marker = showAgents && turn.agent !== undefined ? `[agent: ${turn.agent}] ` : '';
    messages.push({ role: 'assistant', content: `${marker}${turn.answer}` });
  }
  return messages;
}

/** The SDK signal of a reply: aborted once Application requests the stop. */
function abortSignalFor(cancellation: ReplyCancellation): AbortSignal {
  const controller = new AbortController();
  void cancellation.requested.then(() => controller.abort(new ProjectError('Reply production stopped')));
  return controller.signal;
}

function throwStreamError(error: unknown): never {
  if (error instanceof ProjectError) throw error;
  throw new ProjectError('AI SDK response failed', { cause: error });
}

const replyOutput = Output.object({ schema: jsonSchema<{ answer: string; expectsReply: boolean }>({
  type: 'object', properties: { answer: { type: 'string' }, expectsReply: { type: 'boolean' } },
  required: ['answer', 'expectsReply'], additionalProperties: false,
}) });

function withServerPrompts(instructions: string, prompts: readonly string[]): string {
  return prompts.length === 0 ? instructions
    : `${instructions}\n\nInstructions and context from the connected MCP server:\n${prompts.join('\n\n')}`;
}

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
    private readonly discovered: DiscoveredMcp,
    private readonly mcp: ToolClient, private readonly maxToolCalls: number,
    model?: LanguageModel) {
    if (!Number.isSafeInteger(maxToolCalls) || maxToolCalls < 1) {
      throw new ProjectError('Invalid agent tool call limit');
    }
    this.options = aiSdkOptions(settings.options);
    this.model = modelFor(settings, model);
  }

  async *produce(history: ConversationHistory, cancellation: ReplyCancellation): AsyncIterable<ReplyPart> {
    const signal = abortSignalFor(cancellation);
    let used = 0;
    // Structured output reports a failed step only as a missing object; keep the limit failure.
    let limitExceeded: ProjectError | undefined;
    // Read at every turn, so changes on the server apply without a restart.
    const prompts: string[] = [];
    for (const name of this.discovered.prompts) prompts.push(await this.mcp.getPrompt(name, signal));
    const tools = Object.fromEntries(this.discovered.tools.map((available, index) => [
      presentedToolName(available.name, index), tool({
        description: available.description ?? available.name,
        inputSchema: jsonSchema<Record<string, unknown>>(
          available.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: async (input, { abortSignal }) => {
          if (++used > this.maxToolCalls) {
            limitExceeded = new ProjectError('MCP tool call limit exceeded');
            throw limitExceeded;
          }
          return this.mcp.callTool(available.name, input, abortSignal ?? signal);
        },
      }),
    ]));
    const response = streamText({ model: this.model,
      system: replyInstructions(withServerPrompts(this.settings.instructions, prompts)),
      messages: messagesFor(history), tools, output: replyOutput,
      toolCallConcurrency: 1, stopWhen: stepCountIs(this.maxToolCalls + 1),
      maxRetries: 0, abortSignal: signal, ...this.options });
    try {
      const emitted = yield* answerParts(response);
      yield* concludeAnswer(response, emitted);
    } catch (error) { throwStreamError(limitExceeded ?? error); }
  }
}

/** An agent without MCP: it answers with its own model and instructions, without tools. */
export class AiSdkKnowledgeAgentReply implements ProduceConversationReply {
  private readonly model: LanguageModel;
  private readonly options: ReturnType<typeof aiSdkOptions>;

  constructor(private readonly settings: AgentSettings, model?: LanguageModel) {
    this.options = aiSdkOptions(settings.options);
    this.model = modelFor(settings, model);
  }

  async *produce(history: ConversationHistory, cancellation: ReplyCancellation): AsyncIterable<ReplyPart> {
    const signal = abortSignalFor(cancellation);
    const response = streamText({ model: this.model, system: replyInstructions(this.settings.instructions),
      messages: messagesFor(history), output: replyOutput, maxRetries: 0, abortSignal: signal, ...this.options });
    try {
      const emitted = yield* answerParts(response);
      yield* concludeAnswer(response, emitted);
    } catch (error) { throwStreamError(error); }
  }
}

export type DelegatedAgent = Readonly<{ id: string; description: string;
  reply: Pick<ProduceConversationReply, 'produce'> }>;

function routerInstructions(instructions: string, agents: readonly DelegatedAgent[]): string {
  return `${instructions}\nAvailable agents:\n${agents.map(agent => `- ${agent.id}: ${agent.description}`).join('\n')}\n`
    + 'Choose the agent that must answer the last message of the family and put its identifier in agent. '
    + 'Previous answers are marked with [agent: <id>] when the answering agent is known. '
    + 'Do not answer the message yourself.';
}

/** The orchestrator only chooses the agent; the chosen agent formulates the whole reply. */
export class AiSdkOrchestratorReply implements ProduceConversationReply {
  private readonly model: LanguageModel;
  private readonly options: ReturnType<typeof aiSdkOptions>;
  private readonly agents: ReadonlyMap<string, DelegatedAgent>;
  private readonly choice: ReturnType<typeof Output.object<{ agent: string }>>;

  constructor(private readonly settings: AgentSettings,
    private readonly specialists: readonly DelegatedAgent[], model?: LanguageModel) {
    if (specialists.length === 0) throw new ProjectError('No specialist agent configured');
    this.options = aiSdkOptions(settings.options);
    this.model = modelFor(settings, model);
    this.agents = new Map(specialists.map(agent => [agent.id, agent]));
    this.choice = Output.object({ schema: jsonSchema<{ agent: string }>({
      type: 'object', properties: { agent: { type: 'string', enum: [...this.agents.keys()] } },
      required: ['agent'], additionalProperties: false,
    }) });
  }

  async *produce(history: ConversationHistory, cancellation: ReplyCancellation): AsyncIterable<ReplyPart> {
    const signal = abortSignalFor(cancellation);
    let agent: DelegatedAgent | undefined;
    try {
      const result = await generateText({ model: this.model,
        system: routerInstructions(this.settings.instructions, this.specialists),
        messages: messagesFor(history, true), output: this.choice,
        maxRetries: 0, abortSignal: signal, ...this.options });
      const output: unknown = result.output;
      const fields = output !== null && typeof output === 'object' && !Array.isArray(output)
        ? output as Record<string, unknown> : undefined;
      // The schema is a closed choice: anything else selects no agent.
      if (fields && Object.keys(fields).length === 1 && typeof fields.agent === 'string') {
        agent = this.agents.get(fields.agent);
      }
    } catch (error) { throwStreamError(error); }
    if (!agent) throw new ProjectError('Invalid agent choice');
    yield { kind: 'agent', agent: agent.id };
    // The chosen agent answers the original turn from the stored history.
    yield* agent.reply.produce(history, cancellation);
  }
}
