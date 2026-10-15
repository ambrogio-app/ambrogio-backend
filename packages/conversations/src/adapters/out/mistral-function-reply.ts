import { ProjectError } from '../../project-error.js';
import { Mistral } from '@mistralai/mistralai';
import type { ConversationHistory } from '../../application/conversation-history-read.js';
import type { ProduceConversationReply } from '../../application/produce-conversation-reply.js';
import type { AvailableMcpTool } from './mcp-tool-client.js';
import { mistralMessages, mistralOptions, mistralTextContent } from './mistral-conversation-reply.js';
import type { MistralAgentSettings } from './mistral-conversation-reply.js';

type Call = { id: string; index: number; function: { name: string; arguments: string } };
type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content?: string | null;
  toolCalls?: Call[]; toolCallId?: string; name?: string };
type FunctionTool = { type: 'function'; function: { name: string; description?: string;
  parameters: Record<string, unknown> } };
type StreamRequest = { model: string; messages: Message[]; tools?: FunctionTool[];
  toolChoice?: 'auto'; parallelToolCalls?: boolean; temperature?: number; maxTokens?: number };
type StreamEvent = { data: { choices: Array<{ delta: { content?: unknown;
  toolCalls?: Array<{ id?: string; index?: number;
    function: { name: string; arguments: string | Record<string, unknown> } }> | null } }> } };
export type FunctionStream = (request: StreamRequest) => Promise<AsyncIterable<StreamEvent>>;

type ToolClient = { callTool(name: string, args: Record<string, unknown>): Promise<Readonly<{
  isError: boolean; content: readonly unknown[] }>> };

function streamFor(settings: MistralAgentSettings, stream?: FunctionStream): FunctionStream {
  if (stream) return stream;
  const client = new Mistral({ apiKey: settings.apiKey });
  return (request) => client.chat.stream(request as Parameters<typeof client.chat.stream>[0]);
}

function parseArguments(value: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new ProjectError('Invalid model tool arguments'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProjectError('Invalid model tool arguments');
  }
  return parsed as Record<string, unknown>;
}

async function* completion(stream: FunctionStream, request: StreamRequest): AsyncGenerator<
  string, Call[], void> {
  const calls = new Map<number, { id: string; name: string; args: string }>();
  let emittedText = false;
  const events = await stream(request);
  for await (const event of events) {
    for (const choice of event.data.choices) {
      const text = mistralTextContent(choice.delta.content);
      if (text) { emittedText = true; yield text; }
      for (const chunk of choice.delta.toolCalls ?? []) {
        const index = chunk.index ?? 0;
        const previous = calls.get(index) ?? { id: '', name: '', args: '' };
        if (chunk.id) previous.id = chunk.id;
        if (chunk.function.name) previous.name = chunk.function.name;
        if (typeof chunk.function.arguments === 'string') previous.args += chunk.function.arguments;
        else previous.args = JSON.stringify(chunk.function.arguments);
        calls.set(index, previous);
      }
    }
  }
  if (calls.size && emittedText) throw new ProjectError('Mixed model text and tool calls');
  return [...calls].sort(([a], [b]) => a - b).map(([index, value]) => {
    if (!value.id || !value.name) throw new ProjectError('Incomplete model tool call');
    return { id: value.id, index, function: { name: value.name, arguments: value.args } };
  });
}

async function* readCompletion(stream: FunctionStream, request: StreamRequest): AsyncGenerator<
  string, Call[], void> {
  return yield* completion(stream, request);
}

/** One specialist uses only its own discovered MCP tools and per-turn call budget. */
export class MistralToolAgentReply implements ProduceConversationReply {
  private readonly stream: FunctionStream;
  private readonly requestOptions: ReturnType<typeof mistralOptions>;
  private readonly names: Map<string, AvailableMcpTool>;
  private readonly tools: FunctionTool[];

  constructor(private readonly settings: MistralAgentSettings,
    availableTools: readonly AvailableMcpTool[], private readonly mcp: ToolClient,
    private readonly maxToolCalls: number, stream?: FunctionStream) {
    if (!settings.instructions.trim() || !settings.model.trim() || !settings.apiKey.trim()
      || !Number.isSafeInteger(maxToolCalls) || maxToolCalls < 1) {
      throw new ProjectError('Invalid Mistral tool agent configuration');
    }
    this.requestOptions = mistralOptions(settings.options);
    this.stream = streamFor(settings, stream);
    this.names = new Map(availableTools.map((tool, index) => [`mcp_${index}`, tool]));
    this.tools = [...this.names].map(([name, tool]) => ({ type: 'function', function: {
      name, description: tool.description ?? tool.name, parameters: tool.inputSchema,
    } }));
  }

  async *produce(history: ConversationHistory, task?: string): AsyncIterable<string> {
    const messages: Message[] = mistralMessages(history, this.settings.instructions);
    if (task) messages.push({ role: 'user', content: task });
    let used = 0;
    for (;;) {
      const response = readCompletion(this.stream, { model: this.settings.model, messages,
        ...(this.tools.length ? { tools: this.tools, toolChoice: 'auto' as const,
          parallelToolCalls: false } : {}), ...this.requestOptions });
      let step = await response.next();
      while (!step.done) { yield step.value; step = await response.next(); }
      const calls = step.value;
      if (!calls.length) return;
      if (used + calls.length > this.maxToolCalls) throw new ProjectError('MCP tool call limit exceeded');
      const requested = calls.map((call) => {
        const tool = this.names.get(call.function.name);
        if (!tool) throw new ProjectError('Unknown MCP tool selected by model');
        return { call, tool, args: parseArguments(call.function.arguments) };
      });
      messages.push({ role: 'assistant', content: null, toolCalls: calls });
      for (const { call, tool, args } of requested) {
        used++;
        const result = await this.mcp.callTool(tool.name, args);
        messages.push({ role: 'tool', toolCallId: call.id, name: call.function.name,
          content: JSON.stringify(result) });
      }
    }
  }
}

export type DelegatedAgent = Readonly<{ id: string; description: string;
  reply: Pick<MistralToolAgentReply, 'produce'> }>;

/** The orchestrator either streams its own text or delegates once to one specialist. */
export class MistralOrchestratorReply implements ProduceConversationReply {
  private readonly stream: FunctionStream;
  private readonly requestOptions: ReturnType<typeof mistralOptions>;
  private readonly agents: Map<string, DelegatedAgent>;
  private readonly tools: FunctionTool[];

  constructor(private readonly settings: MistralAgentSettings,
    specialists: readonly DelegatedAgent[], stream?: FunctionStream) {
    if (!settings.instructions.trim() || !settings.model.trim() || !settings.apiKey.trim()) {
      throw new ProjectError('Invalid Mistral orchestrator configuration');
    }
    this.requestOptions = mistralOptions(settings.options);
    this.stream = streamFor(settings, stream);
    this.agents = new Map(specialists.map((agent, index) => [`delegate_${index}`, agent]));
    this.tools = [...this.agents].map(([name, agent]) => ({ type: 'function', function: {
      name, description: agent.description,
      parameters: { type: 'object', properties: { task: { type: 'string' } },
        required: ['task'], additionalProperties: false },
    } }));
  }

  async *produce(history: ConversationHistory): AsyncIterable<string> {
    const response = readCompletion(this.stream, { model: this.settings.model,
      messages: mistralMessages(history, this.settings.instructions),
      ...(this.tools.length ? { tools: this.tools, toolChoice: 'auto' as const,
        parallelToolCalls: false } : {}), ...this.requestOptions });
    let step = await response.next();
    while (!step.done) { yield step.value; step = await response.next(); }
    const calls = step.value;
    if (!calls.length) return;
    if (calls.length !== 1) throw new ProjectError('Multiple agent delegations selected');
    const call = calls[0]!;
    const agent = this.agents.get(call.function.name);
    if (!agent) throw new ProjectError('Unknown agent selected by model');
    const args = parseArguments(call.function.arguments);
    if (typeof args.task !== 'string' || !args.task.trim()
      || Object.keys(args).some((key) => key !== 'task')) {
      throw new ProjectError('Invalid agent delegation task');
    }
    yield* agent.reply.produce(history, args.task);
  }
}
