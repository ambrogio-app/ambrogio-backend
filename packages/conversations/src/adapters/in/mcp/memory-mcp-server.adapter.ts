import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { createMcpHandler, fromJsonSchema, McpServer } from '@modelcontextprotocol/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { MemoryMatch } from '../../../application/conversation-memory-search.port.js';
import { maxMemoryResults, type SearchConversations } from '../../../application/search-conversations/search-conversations.use-case.js';
import type { Logger } from '../diagnostic-log.port.js';

export type MemoryMcpDependencies = Readonly<{
  search: SearchConversations;
  /** IANA name of the family's time zone, for the instants of the results. */
  timeZone: string;
  /** Name and version of the server, as it presents itself to the clients. */
  version: string;
  log: Logger;
}>;

type SearchArguments = Readonly<{ query: string; from?: string; to?: string; limit?: number }>;

const defaultLimit = 5;
const maxQueryLength = 500;
const maxTextLength = 1000;
const day = /^\d{4}-\d{2}-\d{2}$/;

const inputSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1, maxLength: maxQueryLength,
      description: 'Words to find. Quote a phrase, write or between alternatives, put - before an excluded word.' },
    from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'First day, YYYY-MM-DD, included.' },
    to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Last day, YYYY-MM-DD, included.' },
    limit: { type: 'integer', minimum: 1, maximum: maxMemoryResults, description: 'Number of results, 5 by default.' },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

const outputSchema = {
  type: 'object',
  properties: {
    results: { type: 'array', items: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' }, turnId: { type: 'string' }, acceptedAt: { type: 'string' },
        question: { type: 'string' }, answer: { type: 'string' },
      },
      required: ['conversationId', 'turnId', 'acceptedAt', 'question', 'answer'],
      additionalProperties: false,
    } },
  },
  required: ['results'],
  additionalProperties: false,
} as const;

/** A calendar day that exists, written as `YYYY-MM-DD`. */
function isDay(value: string): boolean {
  if (!day.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

/** The rule an argument breaks, or undefined when the arguments can be searched. */
function invalidArgument(input: SearchArguments): string | undefined {
  const query = input.query.trim();
  if (query.length < 1 || query.length > maxQueryLength) return `query: from 1 to ${maxQueryLength} characters`;
  if (input.from !== undefined && !isDay(input.from)) return 'from: a day written as YYYY-MM-DD';
  if (input.to !== undefined && !isDay(input.to)) return 'to: a day written as YYYY-MM-DD';
  if (input.from !== undefined && input.to !== undefined && input.to < input.from) return 'to: not before from';
  const limit = input.limit ?? defaultLimit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxMemoryResults) {
    return `limit: an integer from 1 to ${maxMemoryResults}`;
  }
  return undefined;
}

/** An instant in ISO 8601 with the offset of the family's time zone, for example `2026-10-27T09:41:00.000+01:00`. */
export function instantInTimeZone(instant: Date, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23', timeZoneName: 'longOffset',
  }).formatToParts(instant).map(part => [part.type, part.value]));
  const offset = parts.timeZoneName === 'GMT' ? '+00:00' : parts.timeZoneName!.slice(3);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
    + `.${parts.fractionalSecond}${offset}`;
}

function shortened(text: string): string {
  return text.length > maxTextLength ? `${text.slice(0, maxTextLength)}…` : text;
}

function view(match: MemoryMatch, timeZone: string) {
  return { conversationId: match.conversationId, turnId: match.turnId,
    acceptedAt: instantInTimeZone(match.acceptedAt, timeZone),
    question: shortened(match.question), answer: shortened(match.answer) };
}

/** The MCP server of the Memory connector, built once per request by the stateless handler. */
function memoryServer(dependencies: MemoryMcpDependencies): McpServer {
  const server = new McpServer({ name: 'ambrogio-memory', version: dependencies.version },
    { capabilities: { tools: {} } });
  server.registerTool('search_conversations', {
    description: "Search the family's past conversations by words. Returns matching exchanges, most relevant first, "
      + 'with their date.',
    inputSchema: fromJsonSchema<SearchArguments>(inputSchema),
    outputSchema: fromJsonSchema<{ results: ReturnType<typeof view>[] }>(outputSchema),
  }, async (input) => {
    const invalid = invalidArgument(input);
    if (invalid) return { isError: true, content: [{ type: 'text', text: `Invalid argument ${invalid}` }] };
    try {
      const matches = await dependencies.search({ text: input.query.trim(), limit: input.limit ?? defaultLimit,
        ...(input.from === undefined ? {} : { from: input.from }), ...(input.to === undefined ? {} : { to: input.to }) });
      const structuredContent = { results: matches.map(match => view(match, dependencies.timeZone)) };
      return { structuredContent, content: [{ type: 'text', text: JSON.stringify(structuredContent) }] };
    } catch (error) {
      // The words searched stay out of the log.
      dependencies.log.error({ event: 'conversation_memory_search_failed',
        err: error instanceof Error ? error : new Error('Unknown memory search failure', { cause: error }) },
      'Conversation search failed');
      return { isError: true, content: [{ type: 'text', text: 'Conversation search failed' }] };
    }
  });
  return server;
}

/** The request as the web-standard MCP handler receives it, with the body Fastify has already parsed. */
function webRequest(request: FastifyRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) for (const item of value) headers.append(name, item);
  }
  return new Request(new URL(request.url, `http://${request.headers.host ?? 'localhost'}`), {
    method: request.method, headers });
}

async function send(reply: FastifyReply, response: Response): Promise<FastifyReply> {
  reply.status(response.status);
  response.headers.forEach((value, name) => { reply.header(name, value); });
  return reply.send(response.body ? Readable.fromWeb(response.body as unknown as NodeReadableStream) : undefined);
}

/**
 * The route `/memory` of the MCP server of the Memory connector («Server MCP della memoria»), registered by the
 * application under `/mcp`. A request with an `Origin` header is refused before the MCP server.
 */
export function memoryMcpRoutes(dependencies: MemoryMcpDependencies): (scope: FastifyInstance) => void {
  const handler = createMcpHandler(() => memoryServer(dependencies), { legacy: 'stateless' });
  return scope => {
    // The refusals are sent before the body is read, so no body turns them into another answer.
    scope.route({ method: 'POST', url: '/memory',
      onRequest: async (request, reply) => {
        if (request.headers.origin !== undefined) return reply.status(403).send();
        return undefined;
      },
      async handler(request, reply) {
        return send(reply, await handler.fetch(webRequest(request), { parsedBody: request.body }));
      } });
    // The server keeps no session: the session methods of the transport are not allowed.
    const notAllowed = (reply: FastifyReply) => reply.status(405).header('allow', 'POST').send();
    scope.route({ method: ['GET', 'DELETE'], url: '/memory',
      onRequest: async (_request, reply) => notAllowed(reply), handler: (_request, reply) => notAllowed(reply) });
  };
}
