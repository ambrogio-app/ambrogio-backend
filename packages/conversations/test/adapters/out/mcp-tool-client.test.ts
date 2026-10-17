import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { McpToolClient } from '../../../src/adapters/out/mcp-tool-client.js';
import { ProjectError } from '../../../src/project-error.js';

async function testServer() {
  const seen: Array<{ method: string; authorization?: string }> = [];
  const server = createServer(async (request, reply) => {
    const body = await new Promise<string>((resolve) => {
      let text = '';
      request.on('data', (chunk: Buffer) => { text += chunk.toString(); });
      request.on('end', () => resolve(text));
    });
    const rpc = body ? JSON.parse(body) as { id?: number; method?: string } : {};
    seen.push({ method: rpc.method ?? request.method ?? '', authorization: request.headers.authorization });
    if (rpc.method === 'mcp.discover' || rpc.method === 'mcp/discover') {
      reply.writeHead(404).end();
      return;
    }
    // A tool that never answers, like a stalled connector.
    if (rpc.method === 'tools/call' && (rpc as { params?: { name?: string } }).params?.name === 'stall') return;
    if (rpc.method === 'notifications/initialized') {
      reply.writeHead(202).end();
      return;
    }
    const result = rpc.method === 'initialize'
      ? { protocolVersion: '2025-11-25', capabilities: { tools: {} },
        serverInfo: { name: 'test-mcp', version: '1.0.0' } }
      : rpc.method === 'tools/list'
        ? { tools: [{ name: 'echo', description: 'Echo text',
          inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }] }
        : rpc.method === 'tools/call'
          ? { content: [{ type: 'text', text: 'ok' }] }
          : null;
    if (result === null) { reply.writeHead(404).end(); return; }
    reply.writeHead(200, { 'content-type': 'application/json' });
    reply.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`, seen,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }) };
}

test.each([undefined, { type: 'bearer' as const, token: 'agent-token' }])(
  'uses one Streamable HTTP client for discovery and tool calls with auth %j', async (auth) => {
    const server = await testServer();
    let client: McpToolClient | undefined;
    try {
      client = await McpToolClient.connect({ url: server.url, ...(auth ? { auth } : {}) });
      expect(await client.listTools()).toEqual([{ name: 'echo', description: 'Echo text',
        inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }]);
      expect(await client.callTool('echo', { text: 'hello' })).toEqual({ isError: false,
        content: [{ type: 'text', text: 'ok' }] });
      expect(server.seen.filter(({ method }) => method === 'tools/list' || method === 'tools/call')
        .every(({ authorization }) => authorization === (auth ? 'Bearer agent-token' : undefined))).toBe(true);
    } finally {
      await client?.close();
      await server.close();
    }
  },
);

// Verification: Prova del tempo massimo della produzione della risposta
test('aborts an in-flight tool invocation when the turn signal is aborted', async () => {
  const server = await testServer();
  let client: McpToolClient | undefined;
  try {
    client = await McpToolClient.connect({ url: server.url });
    const controller = new AbortController();
    const call = client.callTool('stall', {}, controller.signal);
    setTimeout(() => controller.abort(), 20);
    await expect(call).rejects.toThrow('MCP tool invocation failed');
  } finally {
    await client?.close();
    await server.close();
  }
});

test('preserves the original cause when MCP operations add safe operational context', async () => {
  async function expectContext(operation: Promise<unknown>, message: string, cause: unknown) {
    let caught: unknown;
    try { await operation; } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(ProjectError);
    expect((caught as Error).message).toBe(message);
    expect((caught as Error).cause).toBe(cause);
  }
  const connectionFailure = new Error('PRIVATE_MCP_CONNECTION_DETAIL');
  const connectionProperties = Object.getOwnPropertyDescriptors(connectionFailure);
  const connect = vi.spyOn(Client.prototype, 'connect').mockRejectedValueOnce(connectionFailure);
  const close = vi.spyOn(Client.prototype, 'close').mockResolvedValueOnce(undefined);
  try {
    await expectContext(McpToolClient.connect({ url: 'http://127.0.0.1:1/mcp' }),
      'MCP connection failed', connectionFailure);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(Object.getOwnPropertyDescriptors(connectionFailure)).toEqual(connectionProperties);
  } finally {
    connect.mockRestore();
    close.mockRestore();
  }

  const server = await testServer();
  const client = await McpToolClient.connect({ url: server.url });
  try {
    const discoveryFailure = { marker: 'PRIVATE_MCP_DISCOVERY_DETAIL' };
    const list = vi.spyOn(Client.prototype, 'listTools').mockRejectedValueOnce(discoveryFailure);
    try {
      await expectContext(client.listTools(), 'MCP tool discovery failed', discoveryFailure);
      expect(discoveryFailure).toEqual({ marker: 'PRIVATE_MCP_DISCOVERY_DETAIL' });
    } finally { list.mockRestore(); }

    const invocationFailure = new TypeError('PRIVATE_MCP_INVOCATION_DETAIL');
    const invocationProperties = Object.getOwnPropertyDescriptors(invocationFailure);
    const call = vi.spyOn(Client.prototype, 'callTool').mockRejectedValueOnce(invocationFailure);
    try {
      await expectContext(client.callTool('echo', {}), 'MCP tool invocation failed', invocationFailure);
      expect(Object.getOwnPropertyDescriptors(invocationFailure)).toEqual(invocationProperties);
    } finally { call.mockRestore(); }
  } finally {
    await client.close();
    await server.close();
  }
});

test('keeps Bearer credentials isolated between two MCP agents', async () => {
  const first = await testServer();
  const second = await testServer();
  let firstClient: McpToolClient | undefined;
  let secondClient: McpToolClient | undefined;
  try {
    firstClient = await McpToolClient.connect({ url: first.url,
      auth: { type: 'bearer', token: 'first-token' } });
    secondClient = await McpToolClient.connect({ url: second.url,
      auth: { type: 'bearer', token: 'second-token' } });
    await firstClient.listTools();
    await secondClient.listTools();
    await firstClient.callTool('echo', { text: 'first' });
    await secondClient.callTool('echo', { text: 'second' });
    expect(first.seen.filter(({ method }) => method === 'tools/call')
      .map(({ authorization }) => authorization)).toEqual(['Bearer first-token']);
    expect(second.seen.filter(({ method }) => method === 'tools/call')
      .map(({ authorization }) => authorization)).toEqual(['Bearer second-token']);
  } finally {
    await Promise.allSettled([firstClient?.close(), secondClient?.close()]);
    await Promise.all([first.close(), second.close()]);
  }
});

test.each([false, true])('uses OAuth client credentials and checks the configured issuer (mismatch %s)',
  async (mismatch) => {
    let tokenRequests = 0;
    let expired = false;
    const received: string[] = [];
    let origin = '';
    const server = createServer(async (request, reply) => {
      const path = request.url ?? '';
      const respond = (status: number, value: unknown, headers: Record<string, string> = {}) => {
        reply.writeHead(status, { 'content-type': 'application/json', ...headers });
        reply.end(JSON.stringify(value));
      };
      if (path === '/.well-known/oauth-protected-resource/mcp') {
        respond(200, { resource: `${origin}/mcp`, authorization_servers: [origin] });
        return;
      }
      if (path === '/.well-known/oauth-authorization-server') {
        respond(200, { issuer: origin, token_endpoint: `${origin}/token`,
          authorization_endpoint: `${origin}/authorize`, response_types_supported: ['code'],
          grant_types_supported: ['client_credentials'],
          token_endpoint_auth_methods_supported: ['client_secret_basic'] });
        return;
      }
      if (path === '/token') {
        tokenRequests++;
        const body = await new Promise<string>((resolve) => {
          let text = '';
          request.on('data', (chunk: Buffer) => { text += chunk.toString(); });
          request.on('end', () => resolve(text));
        });
        expect(request.headers.authorization).toBe(`Basic ${Buffer.from('client:secret').toString('base64')}`);
        expect(new URLSearchParams(body).get('grant_type')).toBe('client_credentials');
        expect(new URLSearchParams(body).get('scope')).toBe('read');
        respond(200, { access_token: `issued-token-${tokenRequests}`, token_type: 'Bearer',
          expires_in: 1 });
        return;
      }
      if (path === '/mcp') {
        received.push(request.headers.authorization ?? '');
        if (request.headers.authorization !== `Bearer issued-token-${expired ? 2 : 1}`) {
          respond(401, { error: 'unauthorized' }, { 'www-authenticate':
            `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"` });
          return;
        }
        const body = await new Promise<string>((resolve) => {
          let text = '';
          request.on('data', (chunk: Buffer) => { text += chunk.toString(); });
          request.on('end', () => resolve(text));
        });
        const rpc = body ? JSON.parse(body) as { id?: number; method?: string } : {};
        if (rpc.method === 'notifications/initialized') { reply.writeHead(202).end(); return; }
        const result = rpc.method === 'initialize'
          ? { protocolVersion: '2025-11-25', capabilities: { tools: {} },
            serverInfo: { name: 'oauth-mcp', version: '1.0.0' } }
          : rpc.method === 'tools/list' ? { tools: [] }
            : rpc.method === 'tools/call' ? { content: [{ type: 'text', text: 'ok' }] } : null;
        if (result === null) { reply.writeHead(404).end(); return; }
        respond(200, { jsonrpc: '2.0', id: rpc.id, result });
        return;
      }
      reply.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    let client: McpToolClient | undefined;
    try {
      const connection = { url: `${origin}/mcp`, auth: {
        type: 'oauth_client_credentials' as const, clientId: 'client', clientSecret: 'secret',
        issuer: mismatch ? 'http://127.0.0.1:1' : origin, scope: 'read',
      } };
      if (mismatch) {
        await expect(McpToolClient.connect(connection)).rejects.toThrow();
        expect(tokenRequests).toBe(0);
      } else {
        client = await McpToolClient.connect(connection);
        expect(await client.listTools()).toEqual([]);
        expect(tokenRequests).toBe(1);
        expect(received).toContain('Bearer issued-token-1');
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expired = true;
        expect(await client.callTool('echo', {})).toEqual({ isError: false,
          content: [{ type: 'text', text: 'ok' }] });
        expect(tokenRequests).toBe(2);
        expect(received).toContain('Bearer issued-token-2');
      }
    } finally {
      await client?.close();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }, 15_000);

test('keeps OAuth credentials and tokens isolated across simultaneous MCP agents', async () => {
  async function oauthServer(id: string) {
    const seen: Array<{ method: string; authorization?: string }> = [];
    const tokenCredentials: string[] = [];
    let origin = '';
    const server = createServer(async (request, reply) => {
      const path = request.url ?? '';
      const respond = (status: number, value: unknown, headers: Record<string, string> = {}) => {
        reply.writeHead(status, { 'content-type': 'application/json', ...headers });
        reply.end(JSON.stringify(value));
      };
      if (path === '/.well-known/oauth-protected-resource/mcp') {
        respond(200, { resource: `${origin}/mcp`, authorization_servers: [origin] });
        return;
      }
      if (path === '/.well-known/oauth-authorization-server') {
        respond(200, { issuer: origin, token_endpoint: `${origin}/token`,
          authorization_endpoint: `${origin}/authorize`, response_types_supported: ['code'],
          grant_types_supported: ['client_credentials'],
          token_endpoint_auth_methods_supported: ['client_secret_basic'] });
        return;
      }
      if (path === '/token') {
        tokenCredentials.push(request.headers.authorization ?? '');
        if (request.headers.authorization !== `Basic ${Buffer.from(`${id}:${id}-secret`).toString('base64')}`) {
          respond(401, { error: 'invalid_client' });
          return;
        }
        respond(200, { access_token: `${id}-token`, token_type: 'Bearer', expires_in: 3600 });
        return;
      }
      if (path !== '/mcp') { reply.writeHead(404).end(); return; }
      if (request.headers.authorization !== `Bearer ${id}-token`) {
        respond(401, { error: 'unauthorized' }, { 'www-authenticate':
          `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"` });
        return;
      }
      let body = '';
      for await (const chunk of request) body += chunk.toString();
      const rpc = body ? JSON.parse(body) as { id?: number; method?: string } : {};
      seen.push({ method: rpc.method ?? '', authorization: request.headers.authorization });
      if (rpc.method === 'notifications/initialized') { reply.writeHead(202).end(); return; }
      const result = rpc.method === 'initialize'
        ? { protocolVersion: '2025-11-25', capabilities: { tools: {} },
          serverInfo: { name: id, version: '1.0.0' } }
        : rpc.method === 'tools/list'
          ? { tools: [{ name: `${id}-tool`, inputSchema: { type: 'object' } }] }
          : rpc.method === 'tools/call'
            ? { content: [{ type: 'text', text: `${id}-result` }] } : undefined;
      if (!result) { reply.writeHead(404).end(); return; }
      respond(200, { jsonrpc: '2.0', id: rpc.id, result });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { origin, seen, tokenCredentials,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
  }

  const first = await oauthServer('first');
  const second = await oauthServer('second');
  let firstClient: McpToolClient | undefined;
  let secondClient: McpToolClient | undefined;
  try {
    [firstClient, secondClient] = await Promise.all([
      McpToolClient.connect({ url: `${first.origin}/mcp`, auth: {
        type: 'oauth_client_credentials', clientId: 'first', clientSecret: 'first-secret',
        issuer: first.origin } }),
      McpToolClient.connect({ url: `${second.origin}/mcp`, auth: {
        type: 'oauth_client_credentials', clientId: 'second', clientSecret: 'second-secret',
        issuer: second.origin } }),
    ]);
    const [firstTools, secondTools] = await Promise.all([firstClient.listTools(), secondClient.listTools()]);
    expect(firstTools.map((tool) => tool.name)).toEqual(['first-tool']);
    expect(secondTools.map((tool) => tool.name)).toEqual(['second-tool']);
    expect(await firstClient.callTool('first-tool', {})).toMatchObject({
      content: [{ text: 'first-result' }] });
    expect(await secondClient.callTool('second-tool', {})).toMatchObject({
      content: [{ text: 'second-result' }] });
    for (const [fixture, id] of [[first, 'first'], [second, 'second']] as const) {
      expect(fixture.tokenCredentials).toEqual([
        `Basic ${Buffer.from(`${id}:${id}-secret`).toString('base64')}`]);
      expect(fixture.seen.filter(({ method }) => method === 'tools/list' || method === 'tools/call')
        .map(({ authorization }) => authorization)).toEqual([`Bearer ${id}-token`, `Bearer ${id}-token`]);
    }
    await expect(McpToolClient.connect({ url: `${first.origin}/mcp`, auth: {
      type: 'oauth_client_credentials', clientId: 'first', clientSecret: 'wrong-secret',
      issuer: first.origin } })).rejects.toThrow('MCP connection failed');
    expect(first.seen.filter(({ method }) => method === 'tools/list')).toHaveLength(1);
  } finally {
    await Promise.allSettled([firstClient?.close(), secondClient?.close()]);
    await Promise.all([first.close(), second.close()]);
  }
});
