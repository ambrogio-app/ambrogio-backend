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
    } catch {
      try { await client.close(); } catch { /* preserve the safe connection failure */ }
      throw new Error('MCP connection failed');
    }
  }

  async listTools(): Promise<readonly AvailableMcpTool[]> {
    try {
      const { tools } = await this.client.listTools();
      return tools.map((tool) => ({ name: tool.name, description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> }));
    } catch { throw new Error('MCP tool discovery failed'); }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<Readonly<{
    isError: boolean; content: readonly unknown[];
  }>> {
    try {
      const result = await this.client.callTool({ name, arguments: args });
      return { isError: result.isError === true, content: result.content };
    } catch { throw new Error('MCP tool invocation failed'); }
  }

  async close(): Promise<void> { await this.client.close(); }
}
