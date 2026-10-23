import { llmProviders, type LlmProvider } from '@ambrogio/conversations/adapters/out/ai-sdk-reply';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type McpAuth =
  | Readonly<{ type: 'bearer'; token: string }>
  | Readonly<{ type: 'oauth_client_credentials'; clientId: string; clientSecret: string;
    issuer: string; scope?: string }>;

export type AgentConfig = Readonly<{
  id: string;
  description?: string;
  maxToolCalls?: number;
  instructions: string;
  llm: Readonly<{ provider: LlmProvider; model: string; apiKey: string; baseURL?: string;
    options?: Readonly<Record<string, unknown>> }>;
  mcp?: Readonly<{ url: string; auth?: McpAuth; tools?: readonly string[] }>;
}>;

const agentId = /^[a-z][a-z0-9-]*$/;
let configRevision = 0;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function httpUrl(value: unknown): value is string {
  if (!nonempty(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
  } catch { return false; }
}

/** The names of the MCP tools the agent may use, as the server declares them. */
function parseTools(value: unknown): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || !value.every(nonempty)
    || new Set(value).size !== value.length) {
    throw new ProjectError('Invalid agent MCP tool list');
  }
  return value;
}

function parseAuth(value: unknown): McpAuth {
  const fields = record(value);
  if (fields?.type === 'bearer' && nonempty(fields.token)) {
    return { type: 'bearer', token: fields.token };
  }
  if (fields?.type === 'oauth_client_credentials' && nonempty(fields.clientId)
    && nonempty(fields.clientSecret) && httpUrl(fields.issuer)
    && (fields.scope === undefined || nonempty(fields.scope))) {
    return { type: 'oauth_client_credentials', clientId: fields.clientId,
      clientSecret: fields.clientSecret, issuer: fields.issuer,
      ...(fields.scope === undefined ? {} : { scope: fields.scope as string }) };
  }
  throw new ProjectError('Invalid agent MCP authentication configuration');
}

function isProvider(value: unknown): value is LlmProvider {
  return llmProviders.includes(value as LlmProvider);
}

function parseAgent(id: string, value: unknown): AgentConfig {
  const fields = record(value);
  const llm = record(fields?.llm);
  if (!fields || !nonempty(fields.instructions) || !llm || !isProvider(llm.provider)
    || !nonempty(llm.model) || !nonempty(llm.apiKey)
    || (llm.options !== undefined && !record(llm.options))
    // Only an OpenAI-compatible API needs its address; the others use their provider's endpoint.
    || (llm.provider === 'openai-compatible' ? !httpUrl(llm.baseURL) : llm.baseURL !== undefined)) {
    throw new ProjectError(`Invalid agent configuration: ${id}`);
  }
  const base: AgentConfig = { id, instructions: fields.instructions, llm: {
    provider: llm.provider, model: llm.model, apiKey: llm.apiKey,
    ...(llm.baseURL === undefined ? {} : { baseURL: llm.baseURL as string }),
    ...(llm.options === undefined ? {} : { options: llm.options as Record<string, unknown> }),
  } };
  if (id === 'orchestrator') {
    if (fields.mcp !== undefined || fields.description !== undefined) {
      throw new ProjectError('Orchestrator must not configure MCP or description');
    }
    return base;
  }
  if (!nonempty(fields.description)) throw new ProjectError(`Invalid agent description: ${id}`);
  // Without MCP the agent has instructions and a model only, and no tool call limit.
  if (fields.mcp === undefined) {
    if (fields.maxToolCalls !== undefined) throw new ProjectError(`Invalid agent tool call limit: ${id}`);
    return { ...base, description: fields.description };
  }
  if (!Number.isSafeInteger(fields.maxToolCalls) || (fields.maxToolCalls as number) < 1) {
    throw new ProjectError(`Invalid agent tool call limit: ${id}`);
  }
  const mcp = record(fields.mcp);
  if (!mcp || !httpUrl(mcp.url) || mcp.transport !== undefined) {
    throw new ProjectError(`Invalid agent MCP configuration: ${id}`);
  }
  const tools = parseTools(mcp.tools);
  return { ...base, description: fields.description, maxToolCalls: fields.maxToolCalls as number,
    mcp: { url: mcp.url,
    ...(mcp.auth === undefined ? {} : { auth: parseAuth(mcp.auth) }),
    ...(tools === undefined ? {} : { tools }) } };
}

/** User-owned agent files are discovered once per startup. */
export async function loadAgentConfigs(directory = '/etc/ambrogio/agents'): Promise<Readonly<{
  orchestrator: AgentConfig; specialists: readonly AgentConfig[];
}>> {
  let filenames: string[];
  try { filenames = await readdir(directory); }
  catch { throw new ProjectError('Agent configuration directory unavailable'); }
  if (!filenames.includes('orchestrator.ts')) throw new ProjectError('Missing orchestrator configuration');
  const specialistNames = filenames.filter((name) => name.endsWith('.ts') && name !== 'orchestrator.ts');
  // The orchestrator only chooses: at least one agent must be able to answer.
  if (specialistNames.length === 0) throw new ProjectError('No specialist agent configured');
  for (const filename of specialistNames) {
    if (!agentId.test(filename.slice(0, -3))) throw new ProjectError(`Invalid agent configuration filename: ${filename}`);
  }
  const load = async (filename: string): Promise<AgentConfig> => {
    const id = filename.slice(0, -3);
    try { return parseAgent(id, (await import(`${pathToFileURL(resolve(join(directory, filename))).href}?revision=${++configRevision}`)).default); }
    catch (error) { throw new ProjectError(`Invalid agent configuration: ${id}`, { cause: error }); }
  };
  const orchestrator = await load('orchestrator.ts');
  const specialists = await Promise.all(specialistNames.sort().map(load));
  return { orchestrator, specialists };
}
