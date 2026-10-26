import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, hasToolCall, jsonSchema, Output, stepCountIs, streamText, tool, type LanguageModel,
  type ModelMessage } from 'ai';
import { ProjectError } from '../../domain/project-error.js';
import type { ConversationHistory } from '../../application/conversation-history-read.port.js';
import type { ProduceConversationReply, ReplyCancellation, ReplyPart }
  from '../../application/produce-conversation-reply.port.js';
import type { AvailableMcpTool } from './mcp-tool-client.js';
import type { Logger } from '../in/logger.js';

/** A monotonic clock in milliseconds, for the reply timing. */
export type Clock = () => number;
const monotonic: Clock = () => performance.now();

/** What an agent measured while producing one reply: model calls, MCP calls and the text before the first of them. */
export type ReplyMeasures = { modelSteps: number; toolCalls?: number; toolMs?: number; announcementMs?: number };

/** The final tool of every specialist reply: its only argument is the reply expectation. */
export const finishToolName = 'finish';

/** The providers this adapter can build a model for. */
export const llmProviders = ['mistral', 'openai', 'anthropic', 'google', 'openai-compatible'] as const;
export type LlmProvider = typeof llmProviders[number];

export type AgentSettings = Readonly<{
  provider: LlmProvider;
  instructions: string;
  model: string;
  apiKey: string;
  /** Only for `openai-compatible`: the API the agent talks to. */
  baseURL?: string;
  options?: Readonly<Record<string, unknown>>;
  /** Only for specialists: the clock and time zone of the date line added at every turn. */
  currentTime?: Readonly<{ timeZone: string; clock: Readonly<{ now(): Date }> }>;
  /** Only for specialists: the language selected by the installation. */
  responseLanguage?: 'en' | 'it';
}>;

type ToolClient = {
  callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<Readonly<{
    isError: boolean; content: readonly unknown[];
  }>>;
  getPrompt(name: string, signal?: AbortSignal): Promise<string>;
};

/**
 * What the agent's MCP server offered at startup: its tools and the prompts without required arguments.
 * When `offered` is present, only the listed tools reach the model; positional names keep the discovered index.
 */
export type DiscoveredMcp = Readonly<{ tools: readonly AvailableMcpTool[]; prompts: readonly string[];
  offered?: readonly string[] }>;

/** The MCP name when every provider accepts it; otherwise the reserved positional name. */
function presentedToolName(name: string, index: number): string {
  return /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(name) && !/^mcp_\d+$/.test(name) && name !== finishToolName
    ? name : `mcp_${index}`;
}

export function aiSdkOptions(value?: AgentSettings['options']): Readonly<{
  temperature?: number; maxOutputTokens?: number;
}> {
  if (value === undefined) return {};
  if (Object.keys(value).some(key => key !== 'temperature' && key !== 'max_tokens')) {
    throw new ProjectError('Unsupported model option');
  }
  const temperature = value.temperature;
  const maxTokens = value.max_tokens;
  if (temperature !== undefined && (typeof temperature !== 'number'
    || !Number.isFinite(temperature) || temperature < 0)) {
    throw new ProjectError('Invalid model temperature');
  }
  if (maxTokens !== undefined && (typeof maxTokens !== 'number'
    || !Number.isSafeInteger(maxTokens) || maxTokens < 1)) {
    throw new ProjectError('Invalid model max_tokens');
  }
  return { ...(temperature === undefined ? {} : { temperature: temperature as number }),
    ...(maxTokens === undefined ? {} : { maxOutputTokens: maxTokens as number }) };
}

function modelFor(settings: AgentSettings, model?: LanguageModel): LanguageModel {
  const { provider, apiKey, baseURL } = settings;
  if (!settings.instructions.trim() || !settings.model.trim() || !apiKey.trim()
    || (provider === 'openai-compatible') !== (baseURL !== undefined)) {
    throw new ProjectError('Invalid agent configuration');
  }
  if (model) return model;
  switch (provider) {
    case 'mistral': return createMistral({ apiKey })(settings.model);
    case 'openai': return createOpenAI({ apiKey })(settings.model);
    case 'anthropic': return createAnthropic({ apiKey })(settings.model);
    case 'google': return createGoogleGenerativeAI({ apiKey })(settings.model);
    // Ambrogio needs the reply schema enforced, not just any JSON object.
    case 'openai-compatible': return createOpenAICompatible({ name: 'openai-compatible', baseURL: baseURL!,
      apiKey, supportsStructuredOutputs: true })(settings.model);
  }
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

function withServerPrompts(instructions: string, prompts: readonly string[]): string {
  return prompts.length === 0 ? instructions
    : `${instructions}\n\nInstructions and context from the connected MCP server:\n${prompts.join('\n\n')}`;
}

/** The agent's instructions followed by the current date and time, read at every turn. */
function withCurrentTime(settings: AgentSettings): string {
  const current = settings.currentTime;
  if (!current) return settings.instructions;
  const formatted = new Intl.DateTimeFormat('en-GB', { timeZone: current.timeZone, weekday: 'long',
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(current.clock.now());
  return `${settings.instructions}\nCurrent date and time: ${formatted} (${current.timeZone}).`;
}

function replyInstructions(instructions: string, language?: 'en' | 'it'): string {
  const languageLine = language === undefined ? ''
    : `\nAnswer in ${language === 'it' ? 'Italian' : 'English'}.`;
  // Asked only to end with the tool, models also wrote its call in the text, which would be spoken.
  return `${instructions}${languageLine}\nYour text is spoken to the family exactly as you write it, so write only `
    + `the words of your reply. When the reply is complete, call the ${finishToolName} tool; never write tool calls or `
    + 'JSON in your text.';
}

/** The rules added to the reply instructions of an agent with MCP tools («Frase d'azione prima degli strumenti»). */
const actionReplyRules = '\nBefore you call a tool to carry out an action, first say in one short sentence what you '
  + 'are about to do. Do not say it for a request for information. When an action you announced succeeds, add nothing '
  + 'more. When an action succeeds without an announcement, confirm it in a few words. When an action fails, say what '
  + 'did not work.';

/** `finish` has no execution: the reply ends at its call, which carries the reply expectation. */
const finishTool = tool({
  description: 'Ends the reply. Set expectsReply to true only when your reply asks the family to reply; otherwise false.',
  inputSchema: jsonSchema<{ expectsReply: boolean }>({ type: 'object', properties: { expectsReply: { type: 'boolean' } },
    required: ['expectsReply'], additionalProperties: false }),
});

type ReplyStream = Readonly<{ fullStream: AsyncIterable<{ type: string } & Record<string, unknown>> }>;

/**
 * The text of every step as it is written, a line break between the text of different steps, then the expectation
 * given to `finish`. `onText` and `onToolCall` tell the measures when text is written and when an MCP tool is called.
 */
async function* replyParts(response: ReplyStream, onText: () => void, onToolCall: () => void,
  limit: () => ProjectError | undefined): AsyncGenerator<ReplyPart, void, void> {
  let expectsReply: boolean | undefined;
  let stepWritten = false;
  let separate = false;
  for await (const part of response.fullStream) {
    if (part.type === 'text-delta' && typeof part.text === 'string' && part.text) {
      if (separate) { yield { kind: 'text', text: '\n' }; separate = false; }
      onText();
      stepWritten = true;
      yield { kind: 'text', text: part.text };
    } else if (part.type === 'finish-step') {
      if (stepWritten) separate = true;
      stepWritten = false;
    } else if (part.type === 'tool-call') {
      if (part.toolName === finishToolName) {
        const input = part.input as { expectsReply?: unknown } | undefined;
        if (typeof input?.expectsReply === 'boolean') expectsReply = input.expectsReply;
      } else onToolCall();
    } else if (part.type === 'tool-error') {
      // The call limit fails the turn: the model is not given the chance to answer after it.
      const exceeded = limit();
      if (exceeded) throw exceeded;
    } else if (part.type === 'error') throw part.error;
  }
  if (expectsReply === undefined) throw new ProjectError('Missing reply expectation');
  yield { kind: 'reply_expectation', expectsReply };
}

export class AiSdkToolAgentReply implements ProduceConversationReply {
  private readonly model: LanguageModel;
  private readonly options: ReturnType<typeof aiSdkOptions>;

  constructor(private readonly settings: AgentSettings,
    private readonly discovered: DiscoveredMcp,
    private readonly mcp: ToolClient, private readonly maxToolCalls: number,
    model?: LanguageModel, private readonly now: Clock = monotonic) {
    if (!Number.isSafeInteger(maxToolCalls) || maxToolCalls < 1) {
      throw new ProjectError('Invalid agent tool call limit');
    }
    this.options = aiSdkOptions(settings.options);
    this.model = modelFor(settings, model);
  }

  produce(history: ConversationHistory, cancellation: ReplyCancellation): AsyncIterable<ReplyPart> {
    return this.measured(history, cancellation, { modelSteps: 0 });
  }

  async *measured(history: ConversationHistory, cancellation: ReplyCancellation,
    measures: ReplyMeasures): AsyncIterable<ReplyPart> {
    const started = this.now();
    measures.toolCalls = 0;
    measures.toolMs = 0;
    const signal = abortSignalFor(cancellation);
    let used = 0;
    let limitExceeded: ProjectError | undefined;
    let toolCalled = false;
    // Read at every turn, so changes on the server apply without a restart.
    const prompts: string[] = [];
    for (const name of this.discovered.prompts) prompts.push(await this.mcp.getPrompt(name, signal));
    const offered = this.discovered.offered;
    const tools = Object.fromEntries(this.discovered.tools.flatMap((available, index) =>
      offered && !offered.includes(available.name) ? [] : [[
      presentedToolName(available.name, index), tool({
        description: available.description ?? available.name,
        inputSchema: jsonSchema<Record<string, unknown>>(
          available.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: async (input, { abortSignal }) => {
          if (++used > this.maxToolCalls) {
            limitExceeded = new ProjectError('MCP tool call limit exceeded');
            throw limitExceeded;
          }
          const called = this.now();
          try { return await this.mcp.callTool(available.name, input, abortSignal ?? signal); }
          finally {
            measures.toolCalls! += 1;
            measures.toolMs! += this.now() - called;
          }
        },
      }),
    ]]));
    const response = streamText({ model: this.model,
      system: replyInstructions(withServerPrompts(withCurrentTime(this.settings), prompts),
        this.settings.responseLanguage) + actionReplyRules,
      messages: messagesFor(history), tools: { ...tools, [finishToolName]: finishTool }, toolChoice: 'required',
      toolCallConcurrency: 1, stopWhen: [stepCountIs(this.maxToolCalls + 1), hasToolCall(finishToolName)],
      maxRetries: 0, abortSignal: signal, ...this.options });
    try {
      yield* replyParts(response as unknown as ReplyStream,
        () => { if (!toolCalled && measures.announcementMs === undefined) measures.announcementMs = this.now() - started; },
        () => { toolCalled = true; }, () => limitExceeded);
      measures.modelSteps = (await response.steps).length;
    } catch (error) { throwStreamError(limitExceeded ?? error); }
  }
}

/** An agent without MCP: it answers with its own model and instructions; `finish` is its only tool. */
export class AiSdkKnowledgeAgentReply implements ProduceConversationReply {
  private readonly model: LanguageModel;
  private readonly options: ReturnType<typeof aiSdkOptions>;

  constructor(private readonly settings: AgentSettings, model?: LanguageModel) {
    this.options = aiSdkOptions(settings.options);
    this.model = modelFor(settings, model);
  }

  produce(history: ConversationHistory, cancellation: ReplyCancellation): AsyncIterable<ReplyPart> {
    return this.measured(history, cancellation, { modelSteps: 0 });
  }

  async *measured(history: ConversationHistory, cancellation: ReplyCancellation,
    measures: ReplyMeasures): AsyncIterable<ReplyPart> {
    const signal = abortSignalFor(cancellation);
    // `finish` is the only tool: it carries the reply expectation.
    const response = streamText({ model: this.model,
      system: replyInstructions(withCurrentTime(this.settings), this.settings.responseLanguage),
      messages: messagesFor(history), tools: { [finishToolName]: finishTool }, toolChoice: 'required',
      stopWhen: [stepCountIs(2), hasToolCall(finishToolName)], maxRetries: 0, abortSignal: signal, ...this.options });
    try {
      yield* replyParts(response as unknown as ReplyStream, () => undefined, () => undefined, () => undefined);
      measures.modelSteps = (await response.steps).length;
    } catch (error) { throwStreamError(error); }
  }
}

/** A specialist reply; `measured` also fills the measures of the reply timing. */
type SpecialistReply = Pick<ProduceConversationReply, 'produce'> & Readonly<{
  measured?(history: ConversationHistory, cancellation: ReplyCancellation, measures: ReplyMeasures): AsyncIterable<ReplyPart>;
}>;

export type DelegatedAgent = Readonly<{ id: string; description: string; reply: SpecialistReply }>;

/** Where the orchestrator writes the timing of each reply («Evento diagnostico dei tempi della risposta»). */
export type ReplyTimingLog = Readonly<{ log: Logger; now?: Clock }>;

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

  private readonly now: Clock;

  constructor(private readonly settings: AgentSettings,
    private readonly specialists: readonly DelegatedAgent[], model?: LanguageModel,
    private readonly timing?: ReplyTimingLog) {
    if (specialists.length === 0) throw new ProjectError('No specialist agent configured');
    this.now = timing?.now ?? monotonic;
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
    const routing = this.now();
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
    const routerMs = this.now() - routing;
    yield { kind: 'agent', agent: agent.id };
    // The chosen agent answers the original turn from the stored history.
    const started = this.now();
    const measures: ReplyMeasures = { modelSteps: 0 };
    yield* agent.reply.measured ? agent.reply.measured(history, cancellation, measures)
      : agent.reply.produce(history, cancellation);
    const ms = (value: number) => Math.max(0, Math.round(value));
    this.timing?.log.info({ event: 'conversation_reply_timing', agent: agent.id, routerMs: ms(routerMs),
      agentMs: ms(this.now() - started), modelSteps: measures.modelSteps,
      ...(measures.toolCalls === undefined ? {} : { toolCalls: measures.toolCalls, toolMs: ms(measures.toolMs ?? 0) }),
      ...(measures.announcementMs === undefined ? {} : { announcementMs: ms(measures.announcementMs) }) });
  }
}
