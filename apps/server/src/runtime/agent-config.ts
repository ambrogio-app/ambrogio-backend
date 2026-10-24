import { llmProviders, type LlmProvider } from '@ambrogio/conversations/adapters/out/ai-sdk-reply';
import { readVariable, type EnvironmentVariable, type RuntimeEnvironment }
  from '@ambrogio/conversations/adapters/out/environment-variables';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

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
const variableName = /^[A-Z][A-Z0-9_]*$/;

/** The directory of the agent files; this module alone owns its default. */
export const agentVariables = {
  directory: { name: 'AMBROGIO_AGENTS_DIR', default: { environments: 'all', value: '/etc/ambrogio/agents' } },
} as const satisfies Record<string, EnvironmentVariable>;

/** Read the directory of the agent files from the process environment. */
export function readAgentsDirectory(environment: NodeJS.ProcessEnv, runtime: RuntimeEnvironment): string {
  return readVariable(environment, runtime, agentVariables.directory)!;
}

/** Thrown where a file is invalid; the loader reports it with the agent identifier only. */
class InvalidAgentFile extends Error {}

/** A credential variable named by an agent file is absent or empty: the message names the variable. */
class MissingAgentCredential extends ProjectError {}

/** The fields an object may contain: anything else, a literal secret included, makes the file invalid. */
function only(fields: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(fields).some(key => !allowed.includes(key))) throw new InvalidAgentFile();
}

/** A secret named by its environment variable; the value never comes from the file. */
function secret(id: string, name: unknown, environment: NodeJS.ProcessEnv): string {
  if (typeof name !== 'string' || !variableName.test(name)) throw new InvalidAgentFile();
  const value = environment[name];
  if (value === undefined || value === '') {
    throw new MissingAgentCredential(`Missing environment variable ${name} for agent ${id}`);
  }
  return value;
}

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

function parseAuth(id: string, value: unknown, environment: NodeJS.ProcessEnv): McpAuth {
  const fields = record(value);
  if (fields?.type === 'bearer') {
    only(fields, ['type', 'tokenEnv']);
    return { type: 'bearer', token: secret(id, fields.tokenEnv, environment) };
  }
  if (fields?.type === 'oauth_client_credentials' && nonempty(fields.clientId) && httpUrl(fields.issuer)
    && (fields.scope === undefined || nonempty(fields.scope))) {
    only(fields, ['type', 'clientId', 'clientSecretEnv', 'issuer', 'scope']);
    return { type: 'oauth_client_credentials', clientId: fields.clientId,
      clientSecret: secret(id, fields.clientSecretEnv, environment), issuer: fields.issuer,
      ...(fields.scope === undefined ? {} : { scope: fields.scope as string }) };
  }
  throw new InvalidAgentFile();
}

function isProvider(value: unknown): value is LlmProvider {
  return llmProviders.includes(value as LlmProvider);
}

function parseAgent(id: string, value: unknown, environment: NodeJS.ProcessEnv): AgentConfig {
  const fields = record(value);
  const llm = record(fields?.llm);
  if (!fields || !nonempty(fields.instructions) || !llm || !isProvider(llm.provider)
    || !nonempty(llm.model)
    || (llm.options !== undefined && !record(llm.options))
    // Only an OpenAI-compatible API needs its address; the others use their provider's endpoint.
    || (llm.provider === 'openai-compatible' ? !httpUrl(llm.baseURL) : llm.baseURL !== undefined)) {
    throw new InvalidAgentFile();
  }
  only(fields, id === 'orchestrator' ? ['instructions', 'llm', 'description', 'mcp']
    : ['description', 'instructions', 'llm', 'maxToolCalls', 'mcp']);
  only(llm, ['provider', 'model', 'apiKeyEnv', 'baseURL', 'options']);
  const base: AgentConfig = { id, instructions: fields.instructions, llm: {
    provider: llm.provider, model: llm.model, apiKey: secret(id, llm.apiKeyEnv, environment),
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
  if (!mcp || !httpUrl(mcp.url)) throw new InvalidAgentFile();
  only(mcp, ['url', 'auth', 'tools']);
  const tools = parseTools(mcp.tools);
  return { ...base, description: fields.description, maxToolCalls: fields.maxToolCalls as number,
    mcp: { url: mcp.url,
    ...(mcp.auth === undefined ? {} : { auth: parseAuth(id, mcp.auth, environment) }),
    ...(tools === undefined ? {} : { tools }) } };
}

/** The agent files of the installation are discovered and read once per startup. */
export async function loadAgentConfigs(directory: string, environment: NodeJS.ProcessEnv): Promise<Readonly<{
  orchestrator: AgentConfig; specialists: readonly AgentConfig[];
}>> {
  let filenames: string[];
  try { filenames = await readdir(directory); }
  catch { throw new ProjectError('Agent configuration directory unavailable'); }
  if (!filenames.includes('orchestrator.json')) throw new ProjectError('Missing orchestrator configuration');
  const specialistNames = filenames.filter((name) => name.endsWith('.json') && name !== 'orchestrator.json');
  // The orchestrator only chooses: at least one agent must be able to answer.
  if (specialistNames.length === 0) throw new ProjectError('No specialist agent configured');
  for (const filename of specialistNames) {
    if (!agentId.test(filename.slice(0, -5))) throw new ProjectError(`Invalid agent configuration filename: ${filename}`);
  }
  const load = async (filename: string): Promise<AgentConfig> => {
    const id = filename.slice(0, -5);
    try { return parseAgent(id, JSON.parse(await readFile(join(directory, filename), 'utf8')), environment); }
    catch (error) {
      // A missing credential names its variable; every other failure names the agent only.
      if (error instanceof MissingAgentCredential) throw error;
      throw new ProjectError(`Invalid agent configuration: ${id}`, { cause: error });
    }
  };
  const orchestrator = await load('orchestrator.json');
  const specialists = await Promise.all(specialistNames.sort().map(load));
  return { orchestrator, specialists };
}
