import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, jsonSchema, Output, stepCountIs, streamText, tool, type LanguageModel,
  type ModelMessage } from 'ai';
import { ProjectError } from '../../domain/project-error.js';
import type { JsonValue, TurnAction } from '../../domain/turn.js';
import type { ConversationHistory } from '../../application/conversation-history-read.port.js';
import type { ProduceConversationReply, ReplyCancellation, ReplyPart }
  from '../../application/produce-conversation-reply.port.js';
import type { AvailableMcpTool } from './mcp-tool-client.js';
import type { Logger } from '../in/logger.js';

/** A monotonic clock in milliseconds, for the reply timing. */
export type Clock = () => number;
const monotonic: Clock = () => performance.now();

/** What an agent measured while producing one reply: model calls, MCP calls and the text before the first of them. */
export type ReplyMeasures = { modelSteps: number; toolCalls?: number; toolMs?: number };

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
  return /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(name) && !/^mcp_\d+$/.test(name) ? name : `mcp_${index}`;
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

/**
 * The calls of `actions` and their results, as an assistant message and a tool message. Call identifiers are
 * made here, nine alphanumeric characters as Mistral requires, distinct thanks to the shared counter.
 */
function actionMessages(actions: readonly TurnAction[], counter: { next: number }): ModelMessage[] {
  const calls = actions.map(action => ({ id: `call${String(counter.next++).padStart(5, '0')}`, action }));
  return [
    { role: 'assistant', content: calls.map(({ id, action }) => ({ type: 'tool-call' as const, toolCallId: id,
      toolName: action.tool, input: action.input })) },
    { role: 'tool', content: calls.map(({ id, action }) => ({ type: 'tool-result' as const, toolCallId: id,
      toolName: action.tool, output: action.error === undefined
        ? { type: 'json' as const, value: action.output as JsonValue }
        : { type: 'error-text' as const, value: action.error } })) },
  ];
}

/**
 * The stored conversation («Omissione delle risposte vuote nel contesto», «Azioni conservate del turno»): only
 * the router sees which agent gave each answer; an agent sees the actions left in the history it receives.
 */
function messagesFor(history: ConversationHistory, showAgents = false, counter = { next: 1 }): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const turn of history.turns) {
    messages.push({ role: 'user', content: turn.text });
    if (turn.status !== 'answered') continue;
    if (!showAgents && turn.actions !== undefined) messages.push(...actionMessages(turn.actions, counter));
    // Providers refuse an assistant message with neither text nor tool calls.
    if (!turn.answer.trim()) continue;
    const marker = showAgents && turn.agent !== undefined ? `[agent: ${turn.agent}] ` : '';
    messages.push({ role: 'assistant', content: `${marker}${turn.answer}` });
  }
  return messages;
}

/** The history an agent receives: the actions of the turns another agent answered are not its own. */
function historyFor(history: ConversationHistory, agent: string): ConversationHistory {
  const foreign = (turn: ConversationHistory['turns'][number]) => turn.status === 'answered' && turn.actions !== undefined
    && turn.agent !== agent;
  if (!history.turns.some(foreign)) return history;
  return { ...history, turns: history.turns.map(turn => {
    if (turn.status !== 'answered' || turn.actions === undefined || turn.agent === agent) return turn;
    const { actions: _actions, ...rest } = turn;
    return rest;
  }) };
}

/** The arguments of a tool call as a JSON object; anything else becomes an empty object. */
function toolInput(value: unknown): Readonly<Record<string, JsonValue>> {
  const copy = jsonCopy(value);
  return copy !== null && typeof copy === 'object' && !Array.isArray(copy)
    ? copy as Readonly<Record<string, JsonValue>> : {};
}

/** A JSON copy of what a tool received or returned: undefined members disappear, as on the wire. */
function jsonCopy(value: unknown): JsonValue {
  const text = JSON.stringify(value);
  return text === undefined ? null : JSON.parse(text) as JsonValue;
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
  return `${instructions}${languageLine}\nYour text is spoken to the family exactly as you write it, so write only `
    + 'the words of your reply; never write tool calls or JSON in your text.';
}

/**
 * The rules added to the reply instructions of an agent with MCP tools («Risposta dopo le chiamate agli strumenti»):
 * the reply comes after the tools, when its outcome is known. No example sentence: models copied its verb.
 */
const actionReplyRules = '\nWrite your reply only after your last tool call, when you know how it went. Never say that '
  + 'something was done unless a tool did it in this reply. After an action, say briefly what you did; when an action '
  + 'fails, say what did not work.';

type ReplyStream = Readonly<{ fullStream: AsyncIterable<{ type: string } & Record<string, unknown>> }>;

/** The text of every step as it is written, a line break between the text of different steps, and the MCP calls. */
async function* replyParts(response: ReplyStream, limit: () => ProjectError | undefined): AsyncGenerator<ReplyPart, void, void> {
  let stepWritten = false;
  let separate = false;
  for await (const part of response.fullStream) {
    if (part.type === 'text-delta' && typeof part.text === 'string' && part.text) {
      if (separate) { yield { kind: 'text', text: '\n' }; separate = false; }
      stepWritten = true;
      yield { kind: 'text', text: part.text };
    } else if (part.type === 'finish-step') {
      if (stepWritten) separate = true;
      stepWritten = false;
    } else if (part.type === 'tool-result') {
      yield { kind: 'action', action: { tool: String(part.toolName), input: toolInput(part.input),
        output: jsonCopy(part.output) } };
    } else if (part.type === 'tool-error') {
      // The call limit fails the turn: the model is not given the chance to answer after it.
      const exceeded = limit();
      if (exceeded) throw exceeded;
      const error = part.error instanceof Error && part.error.message ? part.error.message : 'Tool call failed';
      yield { kind: 'action', action: { tool: String(part.toolName), input: toolInput(part.input), error } };
    } else if (part.type === 'error') throw part.error;
  }
}

/** Added to the instructions of the second generation after an empty reply («Nuova richiesta della risposta vuota»). */
const emptyReplyRule = '\nYour reply ended without any words for the family. No tool is available now: write now '
  + 'only the words of your reply to the last message of the family, based on the results of the tools you called.';

/** The text of the second generation, without tools, from the history and the actions of the turn. */
async function* recoveryText(model: LanguageModel, options: ReturnType<typeof aiSdkOptions>, system: string,
  history: ConversationHistory, actions: readonly TurnAction[], signal: AbortSignal): AsyncGenerator<string, void, void> {
  const counter = { next: 1 };
  const messages = messagesFor(history, false, counter);
  if (actions.length > 0) messages.push(...actionMessages(actions, counter));
  const response = streamText({ model, system: system + emptyReplyRule, messages, maxRetries: 0, abortSignal: signal,
    ...options });
  for await (const part of response.fullStream as AsyncIterable<{ type: string } & Record<string, unknown>>) {
    if (part.type === 'text-delta' && typeof part.text === 'string' && part.text) yield part.text;
    else if (part.type === 'error') throw part.error;
  }
}

/**
 * The parts of a reply that has words: when the generation ends with no text but spaces, the text of `recover`
 * follows; a reply still without text fails.
 */
async function* withReplyText(parts: AsyncIterable<ReplyPart>,
  recover: (actions: readonly TurnAction[]) => AsyncIterable<string>): AsyncGenerator<ReplyPart, void, void> {
  let written = false;
  const actions: TurnAction[] = [];
  for await (const part of parts) {
    if (part.kind === 'text' && part.text.trim()) written = true;
    if (part.kind === 'action') actions.push(part.action);
    yield part;
  }
  if (written) return;
  for await (const text of recover(actions)) {
    if (text.trim()) written = true;
    yield { kind: 'text', text };
  }
  if (!written) throw new ProjectError('Empty reply');
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
    measures.toolCalls = 0;
    measures.toolMs = 0;
    const signal = abortSignalFor(cancellation);
    let used = 0;
    let limitExceeded: ProjectError | undefined;
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
    const system = replyInstructions(withServerPrompts(withCurrentTime(this.settings), prompts),
      this.settings.responseLanguage) + actionReplyRules;
    const response = streamText({ model: this.model, system,
      messages: messagesFor(history), tools,
      toolCallConcurrency: 1, stopWhen: stepCountIs(this.maxToolCalls + 1),
      maxRetries: 0, abortSignal: signal, ...this.options });
    let recovered = 0;
    try {
      yield* withReplyText(replyParts(response as unknown as ReplyStream, () => limitExceeded),
      actions => { recovered += 1; return recoveryText(this.model, this.options, system, history, actions, signal); });
      measures.modelSteps = (await response.steps).length + recovered;
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

  produce(history: ConversationHistory, cancellation: ReplyCancellation): AsyncIterable<ReplyPart> {
    return this.measured(history, cancellation, { modelSteps: 0 });
  }

  async *measured(history: ConversationHistory, cancellation: ReplyCancellation,
    measures: ReplyMeasures): AsyncIterable<ReplyPart> {
    const signal = abortSignalFor(cancellation);
    const system = replyInstructions(withCurrentTime(this.settings), this.settings.responseLanguage);
    const response = streamText({ model: this.model, system,
      messages: messagesFor(history), maxRetries: 0, abortSignal: signal, ...this.options });
    let recovered = 0;
    try {
      yield* withReplyText(replyParts(response as unknown as ReplyStream, () => undefined),
        actions => { recovered += 1; return recoveryText(this.model, this.options, system, history, actions, signal); });
      measures.modelSteps = (await response.steps).length + recovered;
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

/** Question marks that make a reply worth checking («Indicazione della replica attesa»): Latin, Greek and full-width. */
const questionMark = /[?\u037E\uFF1F]/;
const endsWithQuestion = (text: string) => /[?\u037E\uFF1F]$/.test(text.trimEnd());

const replyCheckInstructions = 'Decide whether the answer of the assistant waits for the family to reply now. Set '
  + 'expectsReply to true only when the answer asks the family for information, a choice or a confirmation it needs '
  + 'to go on. Set it to false for a polite offer such as "Can I help you with anything else?", for a rhetorical '
  + 'question and for an answer that only reports or confirms something.';

/** The orchestrator only chooses the agent; the chosen agent formulates the whole reply. */
export class AiSdkOrchestratorReply implements ProduceConversationReply {
  private readonly model: LanguageModel;
  private readonly options: ReturnType<typeof aiSdkOptions>;
  private readonly agents: ReadonlyMap<string, DelegatedAgent>;
  private readonly choice: ReturnType<typeof Output.object<{ agent: string }>>;
  private readonly expectation = Output.object({ schema: jsonSchema<{ expectsReply: boolean }>({
    type: 'object', properties: { expectsReply: { type: 'boolean' } }, required: ['expectsReply'],
    additionalProperties: false,
  }) });

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
    const own = historyFor(history, agent.id);
    let answer = '';
    for await (const part of agent.reply.measured ? agent.reply.measured(own, cancellation, measures)
      : agent.reply.produce(own, cancellation)) {
      // The expectation is decided here, from the whole answer.
      if (part.kind === 'reply_expectation') continue;
      if (part.kind === 'text') answer += part.text;
      yield part;
    }
    const agentMs = this.now() - started;
    let replyCheckMs: number | undefined;
    let expectsReply = false;
    if (questionMark.test(answer)) {
      const checking = this.now();
      expectsReply = await this.expectsReply(history, answer, signal);
      replyCheckMs = this.now() - checking;
    }
    yield { kind: 'reply_expectation', expectsReply };
    const ms = (value: number) => Math.max(0, Math.round(value));
    this.timing?.log.info({ event: 'conversation_reply_timing', agent: agent.id, routerMs: ms(routerMs),
      agentMs: ms(agentMs), modelSteps: measures.modelSteps,
      ...(measures.toolCalls === undefined ? {} : { toolCalls: measures.toolCalls, toolMs: ms(measures.toolMs ?? 0) }),
      ...(replyCheckMs === undefined ? {} : { replyCheckMs: ms(replyCheckMs) }) });
  }

  /**
   * Whether an answer with a question waits for a reply, asked to the orchestrator's model with structured output.
   * The answer has already been delivered: when the check fails, a final question mark decides.
   */
  private async expectsReply(history: ConversationHistory, answer: string, signal: AbortSignal): Promise<boolean> {
    const message = history.turns.at(-1)?.text ?? '';
    try {
      const result = await generateText({ model: this.model, system: replyCheckInstructions,
        messages: [{ role: 'user', content: `Message of the family:\n${message}\n\nAnswer of the assistant:\n${answer}` }],
        output: this.expectation, maxRetries: 0, abortSignal: signal, ...this.options });
      const output: unknown = result.output;
      const fields = output !== null && typeof output === 'object' && !Array.isArray(output)
        ? output as Record<string, unknown> : undefined;
      if (fields && Object.keys(fields).length === 1 && typeof fields.expectsReply === 'boolean') return fields.expectsReply;
      throw new ProjectError('Invalid reply expectation');
    } catch (error) {
      if (signal.aborted) throw error;
      // Only the error name and message: provider errors also carry the request, with the conversation texts.
      const cause = error instanceof Error ? { type: error.name, message: error.message } : { type: typeof error };
      this.timing?.log.warn({ event: 'conversation_reply_check_failed', err: cause }, 'Reply expectation check failed');
      return endsWithQuestion(answer);
    }
  }
}
