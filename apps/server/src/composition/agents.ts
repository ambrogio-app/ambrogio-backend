import { McpToolClient } from '@ambrogio/conversations/adapters/out/mcp-tool-client';
import { SystemCurrentTime } from '@ambrogio/conversations/adapters/out/system-current-time';
import type { AvailableMcpTool, McpConnection } from '@ambrogio/conversations/adapters/out/mcp-tool-client';
import { aiSdkOptions, AiSdkKnowledgeAgentReply, AiSdkOrchestratorReply, AiSdkToolAgentReply }
  from '@ambrogio/conversations/adapters/out/ai-sdk-reply';
import { loadAgentConfigs } from '../runtime/agent-config.js';
import type { AgentConfig } from '../runtime/agent-config.js';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { createResourceStack, startupWithCleanup } from '../runtime/lifecycle.js';

type ToolConnection = Pick<McpToolClient, 'listTools' | 'listPrompts' | 'getPrompt' | 'callTool' | 'close'>;

type CurrentTime = Readonly<{ timeZone: string; clock: Readonly<{ now(): Date }> }>;

function settingsFor(config: AgentConfig, currentTime?: CurrentTime, responseLanguage?: 'en' | 'it') {
  return { provider: config.llm.provider, instructions: config.instructions,
    ...(currentTime === undefined ? {} : { currentTime }),
    ...(responseLanguage === undefined ? {} : { responseLanguage }),
    model: config.llm.model, apiKey: config.llm.apiKey, options: config.llm.options,
    ...(config.llm.baseURL === undefined ? {} : { baseURL: config.llm.baseURL }) };
}

/** Prepare each user-defined agent for the future conversational entrypoint. */
export async function prepareAgents(
  directory: string,
  /** The process environment, where the credentials named by the agent files are read. */
  environment: NodeJS.ProcessEnv,
  connect: (connection: McpConnection) => Promise<ToolConnection> = McpToolClient.connect,
  // Specialists only: the orchestrator chooses the agent and does not need the date.
  currentTime: CurrentTime = { timeZone: 'UTC', clock: new SystemCurrentTime() },
  responseLanguage: 'en' | 'it' = 'en',
): Promise<Readonly<{
  orchestrator: AiSdkOrchestratorReply;
  specialists: readonly Readonly<{ id: string; description: string; maxToolCalls?: number;
    reply: AiSdkToolAgentReply | AiSdkKnowledgeAgentReply;
    tools: readonly AvailableMcpTool[]; mcp?: ToolConnection }>[];
  close(): Promise<void>;
}>> {
  const configs = await loadAgentConfigs(directory, environment);
  for (const config of [configs.orchestrator, ...configs.specialists]) {
    try { aiSdkOptions(config.llm.options); }
    catch (error) { throw new ProjectError(`Invalid agent options: ${config.id}`, { cause: error }); }
  }
  // Each MCP connection is closed once, in reverse order of opening, keeping every closing fault.
  const connections = createResourceStack('Agent MCP connections could not be closed');
  try {
    const specialists = [];
    for (const config of configs.specialists) {
      if (!config.mcp) {
        // An agent without MCP opens no connection and is offered no tools.
        specialists.push({ id: config.id, description: config.description!,
          reply: new AiSdkKnowledgeAgentReply(settingsFor(config, currentTime, responseLanguage)), tools: [] });
        continue;
      }
      let mcp: ToolConnection;
      let tools: readonly AvailableMcpTool[];
      let prompts: readonly string[];
      try {
        mcp = await connect(config.mcp);
        const opened = mcp;
        connections.defer(`Agent MCP connection could not be closed: ${config.id}`, () => opened.close());
        tools = await mcp.listTools();
        prompts = await mcp.listPrompts();
      } catch (error) {
        // Name the agent only: URL and credentials stay out of the diagnostic message.
        throw new ProjectError(`Agent MCP connection failed: ${config.id}`, { cause: error });
      }
      const offered = config.mcp.tools;
      if (offered && !offered.every((name) => tools.some((available) => available.name === name))) {
        // Name the agent only, as for a failed connection.
        throw new ProjectError(`Agent MCP tool unavailable: ${config.id}`);
      }
      const reply = new AiSdkToolAgentReply(settingsFor(config, currentTime, responseLanguage),
        { tools, prompts, ...(offered === undefined ? {} : { offered }) }, mcp, config.maxToolCalls!);
      specialists.push({ id: config.id, description: config.description!,
        maxToolCalls: config.maxToolCalls!, reply, mcp,
        tools: offered ? tools.filter((available) => offered.includes(available.name)) : tools });
    }
    const orchestrator = new AiSdkOrchestratorReply(settingsFor(configs.orchestrator), specialists);
    return { orchestrator, specialists,
      close: () => connections.close() };
  } catch (error) {
    const cleanup = await connections.close().then(() => [], () => connections.faults);
    throw startupWithCleanup('Agents could not be prepared', error, cleanup);
  }
}
