import Fastify, { type FastifyInstance } from 'fastify';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { MemoryMatch, MemorySearchQuery } from '../../../application/conversation-memory-search.port.js';
import { instantInTimeZone, memoryMcpRoutes } from './memory-mcp-server.adapter.js';

const servers: FastifyInstance[] = [];
const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()));
  await Promise.all(servers.splice(0).map(server => server.close()));
});

const match: MemoryMatch = { conversationId: 'dc89cb5e-e695-43cc-8a04-917316771ea4',
  turnId: '79e437a8-c11a-48ba-b476-e4fd4712ea58', acceptedAt: new Date('2026-10-20T23:30:00.250Z'),
  question: 'Quando è la visita?', answer: 'x'.repeat(1001) };

async function started(search: (query: MemorySearchQuery) => Promise<readonly MemoryMatch[]>) {
  const errors: Array<Record<string, unknown>> = [];
  const log = { debug: () => {}, info: () => {}, warn: () => {},
    error: (fields: Record<string, unknown>) => { errors.push(fields); }, child: () => log };
  const server = Fastify();
  servers.push(server);
  await server.register(async scope => memoryMcpRoutes({ search, timeZone: 'Europe/Rome', version: '9.9.9', log })(scope),
    { prefix: '/mcp' });
  const origin = await server.listen({ host: '127.0.0.1', port: 0 });
  return { url: new URL('/mcp/memory', origin), errors };
}

async function connected(url: URL) {
  const client = new Client({ name: 'memory-test', version: '0.0.0' });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(url));
  return client;
}

describe('memory MCP server', () => {
  // Verification: Prova del server MCP della memoria
  it('presents one search tool with its schemas and returns the matches with the family time zone', async () => {
    const queries: MemorySearchQuery[] = [];
    const { url } = await started(async query => { queries.push(query); return [match]; });
    const client = await connected(url);
    expect(client.getServerVersion()).toMatchObject({ name: 'ambrogio-memory', version: '9.9.9' });
    expect(Object.keys(client.getServerCapabilities() ?? {})).toEqual(['tools']);
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).toEqual(['search_conversations']);
    expect(tools[0]!.inputSchema).toMatchObject({ required: ['query'],
      properties: { query: { maxLength: 500 }, limit: { minimum: 1, maximum: 20 } } });
    expect(tools[0]!.outputSchema).toMatchObject({ required: ['results'] });
    const result = await client.callTool({ name: 'search_conversations', arguments: { query: '  visita  ' } });
    expect(queries).toEqual([{ text: 'visita', limit: 5 }]);
    const expected = { results: [{ conversationId: match.conversationId, turnId: match.turnId,
      acceptedAt: '2026-10-21T01:30:00.250+02:00', question: 'Quando è la visita?', answer: `${'x'.repeat(1000)}…` }] };
    expect(result.structuredContent).toEqual(expected);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expected) }]);
    await client.callTool({ name: 'search_conversations', arguments: { query: 'visita', from: '2026-10-01',
      to: '2026-10-31', limit: 20 } });
    expect(queries[1]).toEqual({ text: 'visita', from: '2026-10-01', to: '2026-10-31', limit: 20 });
  });

  // Verification: Prova della ricerca nella memoria
  it('refuses invalid arguments without searching, naming the argument', async () => {
    let searched = false;
    const { url } = await started(async () => { searched = true; return []; });
    const client = await connected(url);
    for (const [args, name] of [[{ query: '   ' }, 'query'], [{ query: 'x', from: '2026-02-30' }, 'from'],
      [{ query: 'x', to: '20261001' }, 'to'], [{ query: 'x', from: '2026-10-02', to: '2026-10-01' }, 'to'],
      [{ query: 'x', limit: 21 }, 'limit'], [{ query: 'x'.repeat(501) }, 'query']] as const) {
      const result = await client.callTool({ name: 'search_conversations', arguments: args });
      expect(result.isError, JSON.stringify(args)).toBe(true);
      expect(JSON.stringify(result.content), JSON.stringify(args)).toContain(name);
    }
    expect(searched).toBe(false);
  });

  it('reports a failed search with a fixed text and one log event without the words searched', async () => {
    const { url, errors } = await started(async () => { throw new Error('database down'); });
    const client = await connected(url);
    const result = await client.callTool({ name: 'search_conversations', arguments: { query: 'segreto-marcatore' } });
    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Conversation search failed' }] });
    expect(errors).toEqual([expect.objectContaining({ event: 'conversation_memory_search_failed' })]);
    expect(JSON.stringify(errors, (_key, value: unknown) => value instanceof Error ? value.message : value))
      .not.toContain('segreto-marcatore');
  });

  // Verification: Prova del server MCP della memoria
  it('refuses a request with an Origin header and the session methods', async () => {
    const { url } = await started(async () => []);
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    expect((await fetch(url, { method: 'POST', body, headers: { ...headers, origin: 'https://evil.example' } })).status)
      .toBe(403);
    expect((await fetch(url, { method: 'GET', headers: { accept: 'text/event-stream' } })).status).toBe(405);
    expect((await fetch(url, { method: 'DELETE' })).status).toBe(405);
  });

  it('writes instants with the offset of the time zone, also in UTC', () => {
    expect(instantInTimeZone(new Date('2026-07-01T10:00:00Z'), 'Europe/Rome')).toBe('2026-07-01T12:00:00.000+02:00');
    expect(instantInTimeZone(new Date('2026-07-01T10:00:00Z'), 'UTC')).toBe('2026-07-01T10:00:00.000+00:00');
  });
});
