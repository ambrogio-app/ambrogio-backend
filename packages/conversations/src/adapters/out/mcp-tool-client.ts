import { ProjectError } from '../../project-error.js';
import { Client, ClientCredentialsProvider, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

export type McpConnection = Readonly<{
  url: string;
  auth?: Readonly<{ type: 'bearer'; token: string }>
    | Readonly<{ type: 'oauth_client_credentials'; clientId: string; clientSecret: string;
      issuer: string; scope?: string }>;
}>;

export type AvailableMcpTool = Readonly<{
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}>;

/** A provider-neutral view of one agent's MCP server. */
export class McpToolClient {
  private constructor(private readonly client: Client) {}

  static async connect(connection: McpConnection): Promise<McpToolClient> {
    const client = new Client({ name: 'ambrogio', version: '0.0.0' });
    const auth = connection.auth;
    const authProvider = auth?.type === 'bearer'
      ? { token: async () => auth.token }
      : auth?.type === 'oauth_client_credentials'
        ? new ClientCredentialsProvider({
          clientId: auth.clientId,
          clientSecret: auth.clientSecret,
          expectedIssuer: auth.issuer,
          ...(auth.scope === undefined ? {} : { scope: auth.scope }),
        }) : undefined;
    const transport = new StreamableHTTPClientTransport(new URL(connection.url),
      authProvider ? { authProvider } : undefined);
    try {
      await client.connect(transport);
      return new McpToolClient(client);
    } catch (error) {
      try { await client.close(); } catch { /* preserve the safe connection failure */ }
      throw new ProjectError('MCP connection failed', { cause: error });
    }
  }

  async listTools(): Promise<readonly AvailableMcpTool[]> {
    try {
      const { tools } = await this.client.listTools();
      return tools.map((tool) => ({ name: tool.name, description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> }));
    } catch (error) { throw new ProjectError('MCP tool discovery failed', { cause: error }); }
  }

  /** Names of the prompts without required arguments, in the server's order; none without the capability. */
  async listPrompts(): Promise<readonly string[]> {
    if (!this.client.getServerCapabilities()?.prompts) return [];
    try {
      const { prompts } = await this.client.listPrompts();
      return prompts.filter((prompt) => !(prompt.arguments ?? []).some((argument) => argument.required))
        .map((prompt) => prompt.name);
    } catch (error) { throw new ProjectError('MCP prompt discovery failed', { cause: error }); }
  }

  /** The text contents of one prompt's messages, separated by a blank line. */
  async getPrompt(name: string, signal?: AbortSignal): Promise<string> {
    try {
      const { messages } = await this.client.getPrompt({ name }, signal ? { signal } : undefined);
      return messages.flatMap((message) => message.content.type === 'text' ? [message.content.text] : [])
        .join('\n\n');
    } catch (error) { throw new ProjectError('MCP prompt retrieval failed', { cause: error }); }
  }

  /** The signal cancels the request still in flight when the turn must stop. */
  async callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<Readonly<{
    isError: boolean; content: readonly unknown[];
  }>> {
    try {
      const result = await this.client.callTool({ name, arguments: args }, signal ? { signal } : undefined);
      return { isError: result.isError === true, content: result.content };
    } catch (error) { throw new ProjectError('MCP tool invocation failed', { cause: error }); }
  }

  async close(): Promise<void> { await this.client.close(); }
}
