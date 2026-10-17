import { McpToolClient } from '@ambrogio/conversations/adapters/out/mcp-tool-client';
import type { AvailableMcpTool, McpConnection } from '@ambrogio/conversations/adapters/out/mcp-tool-client';
import { aiSdkOptions, AiSdkKnowledgeAgentReply, AiSdkOrchestratorReply, AiSdkToolAgentReply }
  from '@ambrogio/conversations/adapters/out/ai-sdk-reply';
import { loadAgentConfigs } from '../runtime/agent-config.js';
import type { AgentConfig } from '../runtime/agent-config.js';

type ToolConnection = Pick<McpToolClient, 'listTools' | 'callTool' | 'close'>;

function settingsFor(config: AgentConfig) {
  return { instructions: config.instructions,
    model: config.llm.model, apiKey: config.llm.apiKey, options: config.llm.options };
}

/** Prepare each user-defined agent for the future conversational entrypoint. */
export async function prepareAgents(
  directory = '/etc/ambrogio/agents',
  connect: (connection: McpConnection) => Promise<ToolConnection> = McpToolClient.connect,
): Promise<Readonly<{
  orchestrator: AiSdkOrchestratorReply;
  specialists: readonly Readonly<{ id: string; description: string; maxToolCalls?: number;
    reply: AiSdkToolAgentReply | AiSdkKnowledgeAgentReply;
    tools: readonly AvailableMcpTool[]; mcp?: ToolConnection }>[];
  close(): Promise<void>;
}>> {
  const configs = await loadAgentConfigs(directory);
  for (const config of [configs.orchestrator, ...configs.specialists]) {
    aiSdkOptions(config.llm.options);
  }
  const opened: ToolConnection[] = [];
  try {
    const specialists = [];
    for (const config of configs.specialists) {
      if (!config.mcp) {
        // An agent without MCP opens no connection and is offered no tools.
        specialists.push({ id: config.id, description: config.description!,
          reply: new AiSdkKnowledgeAgentReply(settingsFor(config)), tools: [] });
        continue;
      }
      const mcp = await connect(config.mcp);
      opened.push(mcp);
      const tools = await mcp.listTools();
      const reply = new AiSdkToolAgentReply(settingsFor(config), tools, mcp,
        config.maxToolCalls!);
      specialists.push({ id: config.id, description: config.description!,
        maxToolCalls: config.maxToolCalls!, reply, tools, mcp });
    }
    const orchestrator = new AiSdkOrchestratorReply(settingsFor(configs.orchestrator), specialists);
    return { orchestrator, specialists,
      async close() { await Promise.all(opened.map((mcp) => mcp.close())); } };
  } catch (error) {
    await Promise.allSettled(opened.map((mcp) => mcp.close()));
    throw error;
  }
}
