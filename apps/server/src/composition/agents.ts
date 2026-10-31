import { McpToolClient } from '@ambrogio/conversations/adapters/out/mcp-tool-client';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import type { AvailableMcpTool, McpConnection } from '@ambrogio/conversations/adapters/out/mcp-tool-client';
import { aiSdkOptions, AiSdkKnowledgeAgentReply, AiSdkOrchestratorReply, AiSdkToolAgentReply, DeferredAgentReply }
  from '@ambrogio/conversations/adapters/out/ai-sdk-reply';
import type { Logger } from '@ambrogio/conversations/adapters/in/diagnostic-log';
import { loadAgentConfigs } from '../runtime/agent-config.js';
import type { AgentConfig } from '../runtime/agent-config.js';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { createResourceStack } from '../runtime/lifecycle.js';

type ToolConnection = Pick<McpToolClient, 'listTools' | 'listPrompts' | 'getPrompt' | 'callTool' | 'close'>;

type CurrentTime = Readonly<{ timeZone: string; clock: Readonly<{ now(): Date }> }>;

function settingsFor(config: AgentConfig, currentTime?: CurrentTime, responseLanguage?: 'en' | 'it') {
  return { provider: config.llm.provider, instructions: config.instructions,
    ...(currentTime === undefined ? {} : { currentTime }),
    ...(responseLanguage === undefined ? {} : { responseLanguage }),
    model: config.llm.model, apiKey: config.llm.apiKey, options: config.llm.options,
    ...(config.llm.baseURL === undefined ? {} : { baseURL: config.llm.baseURL }) };
}

type Specialist = Readonly<{ id: string; description: string; maxToolCalls?: number;
  reply: AiSdkKnowledgeAgentReply | DeferredAgentReply }>;

/** A failed connection attempt, as logged by «Connessione asincrona dei connettori MCP». */
class AgentUnavailable extends Error {
  constructor(readonly reason: 'connection_failed' | 'tool_unavailable', readonly cause: ProjectError,
    readonly tool?: string) { super(cause.message); }
}

/**
 * Prepare each user-defined agent before listening, without contacting any MCP server. `connect` starts, once and
 * without waiting, the single connection attempt of every agent with an MCP connector; it is called after the
 * listener opens («Connessione asincrona dei connettori MCP»).
 */
export async function prepareAgents(
  directory: string,
  /** The process environment, where the credentials named by the agent files are read. */
  environment: NodeJS.ProcessEnv,
  connectClient: (connection: McpConnection) => Promise<ToolConnection> = McpToolClient.connect,
  // Specialists only: the orchestrator chooses the agent and does not need the date.
  currentTime: CurrentTime = { timeZone: 'UTC', clock: new SystemCurrentTime() },
  responseLanguage: 'en' | 'it' = 'en',
  /** The base logger, where the orchestrator writes the timing of each reply and failed attempts are reported. */
  log?: Logger,
): Promise<Readonly<{
  orchestrator: AiSdkOrchestratorReply;
  specialists: readonly Specialist[];
  /** Starts the connection attempts; the returned promise settles when every attempt has its outcome. */
  connect(): Promise<void>;
  close(): Promise<void>;
}>> {
  const configs = await loadAgentConfigs(directory, environment);
  for (const config of [configs.orchestrator, ...configs.specialists]) {
    try { aiSdkOptions(config.llm.options); }
    catch (error) { throw new ProjectError(`Invalid agent options: ${config.id}`, { cause: error }); }
  }
  // Each MCP connection is closed once, in reverse order of opening, keeping every closing fault.
  const connections = createResourceStack('Agent MCP connections could not be closed');
  const deferred: { config: AgentConfig; reply: DeferredAgentReply }[] = [];
  const specialists: Specialist[] = configs.specialists.map((config) => {
    if (!config.mcp) {
      // An agent without MCP opens no connection and is offered no tools.
      return { id: config.id, description: config.description!,
        reply: new AiSdkKnowledgeAgentReply(settingsFor(config, currentTime, responseLanguage)) };
    }
    const reply = new DeferredAgentReply(config.id);
    deferred.push({ config, reply });
    return { id: config.id, description: config.description!, maxToolCalls: config.maxToolCalls!, reply };
  });
  const orchestrator = new AiSdkOrchestratorReply(settingsFor(configs.orchestrator), specialists, undefined,
    log === undefined ? undefined : { log });
  let closing = false;
  let attempts: Promise<void> | undefined;

  /** The single attempt of one agent; it never throws: a failure is logged and leaves the agent unavailable. */
  async function attempt(config: AgentConfig, reply: DeferredAgentReply): Promise<void> {
    let mcp: ToolConnection | undefined;
    let registered = false;
    try {
      let tools: readonly AvailableMcpTool[];
      let prompts: readonly string[];
      try {
        mcp = await connectClient(config.mcp!);
        tools = await mcp.listTools();
        prompts = await mcp.listPrompts();
      } catch (error) {
        // Name the agent only: URL and credentials stay out of the diagnostic message.
        throw new AgentUnavailable('connection_failed',
          new ProjectError(`Agent MCP connection failed: ${config.id}`, { cause: error }));
      }
      const offered = config.mcp!.tools;
      const missing = offered?.find((name) => !tools.some((available) => available.name === name));
      if (missing !== undefined) {
        throw new AgentUnavailable('tool_unavailable',
          new ProjectError(`Agent MCP tool unavailable: ${config.id}`), missing);
      }
      // A connection that completes after the shutdown started is closed at once.
      if (closing) throw new ProjectError('Server shutdown started');
      const opened = mcp;
      connections.defer(`Agent MCP connection could not be closed: ${config.id}`, () => opened.close());
      registered = true;
      reply.settle(new AiSdkToolAgentReply(settingsFor(config, currentTime, responseLanguage),
        { tools, prompts, ...(offered === undefined ? {} : { offered }) }, opened, config.maxToolCalls!));
    } catch (error) {
      reply.settle(undefined);
      // A client created by a failed attempt is closed here; a registered one closes with the others.
      if (mcp && !registered) await mcp.close().catch(() => { /* the attempt already failed */ });
      if (error instanceof AgentUnavailable) {
        log?.error({ event: 'agent_mcp_unavailable', agent: config.id, reason: error.reason,
          ...(error.tool === undefined ? {} : { tool: error.tool }), err: error.cause }, 'Agent MCP unavailable');
      }
    }
  }

  return { orchestrator, specialists,
    connect() {
      attempts ??= Promise.all(deferred.map(({ config, reply }) => attempt(config, reply))).then(() => undefined);
      return attempts;
    },
    async close() {
      closing = true;
      // Attempts still in progress end first, so that their clients are closed too.
      await attempts;
      // Agents never connected stay unavailable for any turn still waiting.
      for (const { reply } of deferred) reply.settle(undefined);
      await connections.close();
    } };
}
