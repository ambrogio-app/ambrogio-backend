import { serverEnvironment, testEnvironment, writeAgentFile } from '../../test/support/config-fixture.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import WebSocket from 'ws';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { ReplyPart } from '@ambrogio/conversations/application/produce-conversation-reply';
import { openConversationArchive } from '@ambrogio/conversations/adapters/out/postgres/archive';
import { PostgresConversationHistoryRead } from '@ambrogio/conversations/adapters/out/postgres/history-read';
import { PostgresTurnRepository } from '@ambrogio/conversations/adapters/out/postgres/turn-repository';
import { McpToolClient } from '@ambrogio/conversations/adapters/out/mcp-tool-client';
import { AiSdkOrchestratorReply, AiSdkToolAgentReply } from '@ambrogio/conversations/adapters/out/ai-sdk-reply';
import { prepareConfiguredConversations } from '../composition/conversations.js';
import { loadAgentConfigs } from './agent-config.js';
import { buildConversationServer } from '../composition/http-surface.js';
import { surfaceOptions } from '../../test/support/logger-fixture.js';
import { startConversationServer } from '../../test/support/start-server.js';
import { closeAllClients, ProtocolClient, takeSchemaViolations } from '../../test/support/protocol-client.js';
import { emptyTestDatabase, publicTables, querySql, testDatabaseServer } from '../../../../test/support/test-database.js';

const directories: string[] = [];
const databases: Array<() => Promise<void>> = [];
afterEach(async () => {
  await closeAllClients();
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  await Promise.all(databases.splice(0).map(drop => drop()));
  expect(takeSchemaViolations()).toEqual([]);
});

const failure = "I can't complete the response.";
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function text(value: string): ReplyPart { return { kind: 'text', text: value }; }
function expectation(expectsReply = false): ReplyPart { return { kind: 'reply_expectation', expectsReply }; }

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'ambrogio-conversation-server-'));
  directories.push(directory);
  const database = await emptyTestDatabase();
  databases.push(() => database.drop());
  return { directory, database: database.url };
}

/** The archive opened as the server opens it, outside the server under test. */
function openArchive(url: string) {
  return openConversationArchive(url, () => undefined);
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

function sessionUrl(port: number): string { return `ws://127.0.0.1:${port}/api/session`; }

/** Listen a built (not started) conversation server on an ephemeral port. */
async function listen(built: Awaited<ReturnType<typeof buildConversationServer>>): Promise<number> {
  await built.server.listen({ host: '127.0.0.1', port: 0 });
  return (built.server.server.address() as AddressInfo).port;
}

function gate() {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  return { waiting, release };
}

async function conversationTurns(origin: string, id: string): Promise<Array<{
  text: string; status: string; answer?: string; error?: string;
}>> {
  const response = await fetch(`${origin}/api/v1/conversations/${id}`);
  expect(response.status).toBe(200);
  return (await response.json() as { turns: Array<{
    text: string; status: string; answer?: string; error?: string;
  }> }).turns;
}

async function waitForTurn(origin: string, id: string, status: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const turns = await conversationTurns(origin, id);
    if (turns[0]?.status === status) return turns;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Turn did not reach ${status}`);
}

/** Open a WebSocket upgrade and capture the response status and headers. */
async function upgradeResponse(url: string, origin?: string): Promise<Readonly<{
  status: number; headers: Record<string, string | string[] | undefined> }>> {
  const ws = new WebSocket(url, ['ambrogio.v1'], origin ? { origin } : {});
  return new Promise((resolve, reject) => {
    ws.once('upgrade', response => {
      resolve({ status: response.statusCode ?? 0, headers: response.headers });
      ws.once('open', () => ws.close());
    });
    ws.once('unexpected-response', (_request, response) => {
      resolve({ status: response.statusCode ?? 0, headers: response.headers });
      ws.terminate();
    });
    ws.once('error', reject);
  });
}

test('the session ingress uses the orchestrator and GET routes retain security, CORS and correlation headers', async () => {
  const files = await fixture();
  const prepared = await prepareConfiguredConversations({ databaseUrl: files.database,
    listPageSize: 20, maxListPageSize: 100, historyTurns: 20, language: 'en', timeZone: 'UTC' }, new Date(), () => undefined);
  const built = await buildConversationServer({ host: '127.0.0.1', port: 3000,
    allowedOrigins: ['https://client.test'], publicHttps: true, hstsMaxAgeSeconds: 600 },
  prepared, { async *produce() { yield text('Hello'); yield text(' world'); yield expectation(); } }, undefined, undefined, surfaceOptions());
  const { server, turnIngress } = built;
  try {
    const port = await listen(built);
    const preflight = await server.inject({ method: 'OPTIONS', url: '/api/v1/conversations',
      headers: { origin: 'https://client.test', 'access-control-request-method': 'GET' } });
    expect(preflight.headers['access-control-allow-methods']).toContain('GET');
    expect(preflight.headers['access-control-allow-methods']).not.toContain('POST');
    expect(preflight.headers['access-control-allow-origin']).toBe('https://client.test');
    const rejected = await server.inject({ method: 'OPTIONS', url: '/api/v1/conversations',
      headers: { origin: 'https://other.test', 'access-control-request-method': 'GET' } });
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();

    const client = await ProtocolClient.ready(sessionUrl(port), { origin: 'https://client.test' });
    const turn = await client.textTurn('Hi');
    expect(turn.outputs.map(output => output.text)).toEqual(['Hello world']);
    expect(turn.final).toEqual({ type: 'turn.completed', turnId: turn.accepted!.turnId, expectsReply: false });
    expect((await upgradeResponse(sessionUrl(port), 'https://other.test')).status).toBe(403);

    const list = await server.inject({ method: 'GET', url: '/api/v1/conversations',
      headers: { origin: 'https://client.test' } });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect(list.headers['access-control-allow-origin']).toBe('https://client.test');
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.headers['strict-transport-security']).toBe('max-age=600');
    expect(list.headers['x-content-type-options']).toBe('nosniff');
    expect(list.headers['x-request-id']).toMatch(uuidV4);
    const history = await server.inject({ method: 'GET',
      url: `/api/v1/conversations/${turn.accepted!.conversationId}` });
    expect(history.headers['x-request-id']).toMatch(uuidV4);
    expect(history.headers['x-request-id']).not.toBe(list.headers['x-request-id']);

    await turnIngress.stopAccepting();
    const afterStop = await client.textTurn('too late');
    expect(afterStop.final).toMatchObject({ type: 'turn.rejected', reason: 'unavailable',
      message: 'Service temporarily unavailable.' });
    expect((await server.inject({ method: 'GET', url: '/api/v1/conversations' })).json().items)
      .toHaveLength(1);
  } finally {
    await closeAllClients();
    await turnIngress.closeSessions();
    await server.close();
    await prepared.archive.close();
  }
});

test('shutdown interrupts a pending turn without waiting for the remote reply', async () => {
  const files = await fixture();
  const port = await freePort();
  let started!: () => void;
  const producing = new Promise<void>((resolve) => { started = resolve; });
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  let closed = false;
  let persistedBeforeAgentClose = false;
  const runtime = await startConversationServer(serverEnvironment(files, port, files.directory),
  async () => ({ orchestrator: { async *produce() {
    started(); await wait; yield text('too late'); yield expectation();
  } },
  async close() {
    const archive = await openArchive(files.database);
    try {
      const rows = await archive.db.selectFrom('turns').select(['status', 'answer']).execute();
      persistedBeforeAgentClose = rows.length === 1 && rows[0]?.status === 'interrupted'
        && rows[0].answer === null;
    } finally { await archive.close(); }
    closed = true;
  } }));
  try {
    const client = await ProtocolClient.ready(sessionUrl(port));
    const requestId = client.requestId();
    client.startText(requestId);
    client.chunk(requestId, 'Hi');
    client.end(requestId);
    const accepted = await client.waitFor(message => message.type === 'turn.accepted');
    await producing;
    const closing = runtime.close();
    const late = await ProtocolClient.ready(sessionUrl(port)).catch(() => undefined);
    const lateTurn = late?.textTurn('too late to start').catch(() => undefined);
    await expect(Promise.race([closing, new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown waited for remote reply')), 1000))])).resolves.toBeUndefined();
    expect(closed).toBe(true);
    expect(persistedBeforeAgentClose).toBe(true);
    const lateResult = await lateTurn;
    if (lateResult) expect(lateResult.final.type).not.toBe('turn.completed');
    const result = await client.result(requestId);
    expect(result.final).toEqual({ type: 'turn.interrupted', turnId: accepted.turnId });
    await client.closed;
    release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(client.json().some(message => message.type === 'turn.completed')).toBe(false);
    const archive = await openArchive(files.database);
    try {
      const rows = await archive.db.selectFrom('turns').select(['status', 'answer']).execute();
      expect(rows).toEqual([{ status: 'interrupted', answer: null }]);
    } finally { await archive.close(); }
    const restarted = await startConversationServer(serverEnvironment(files, port, files.directory),
    async () => ({ orchestrator: { async *produce() { yield text('after restart'); yield expectation(); } },
      async close() {} }));
    try {
      const next = await (await ProtocolClient.ready(sessionUrl(port))).textTurn('Again');
      expect(next.final.type).toBe('turn.completed');
      expect(next.outputs[0]!.text).toBe('after restart');
    } finally {
      await closeAllClients();
      await restarted.close();
    }
  } finally {
    release();
    await runtime.close();
  }
});

test('shutdown preserves a turn already completed before interruption', async () => {
  const files = await fixture();
  const port = await freePort();
  const runtime = await startConversationServer(serverEnvironment(files, port, files.directory),
  async () => ({ orchestrator: { async *produce() { yield text('completed answer'); yield expectation(); } },
    async close() {} }));
  try {
    const client = await ProtocolClient.ready(sessionUrl(port));
    expect((await client.textTurn('Finish first')).final.type).toBe('turn.completed');
    await runtime.close();
    await client.closed;
    expect(client.json().some(message => message.type === 'turn.interrupted')).toBe(false);
    const archive = await openArchive(files.database);
    try {
      expect(await archive.db.selectFrom('turns').select(['status', 'answer']).execute())
        .toEqual([{ status: 'answered', answer: 'completed answer' }]);
    } finally { await archive.close(); }
  } finally { await runtime.close(); }
});

test('keeps the archive writable while waiting for an agent and while streaming the reply', async () => {
  const files = await fixture();
  const port = await freePort();
  const agentGate = gate();
  const streamGate = gate();
  let agentStarted!: () => void;
  let streamStarted!: () => void;
  const waitingForAgent = new Promise<void>(resolve => { agentStarted = resolve; });
  const waitingDuringStream = new Promise<void>(resolve => { streamStarted = resolve; });
  const runtime = await startConversationServer(serverEnvironment(files, port, files.directory),
  async () => ({ orchestrator: { async *produce() {
    agentStarted();
    await agentGate.waiting;
    yield text('first');
    streamStarted();
    await streamGate.waiting;
    yield text(' second');
    yield expectation();
  } }, async close() {} }));
  // An independent connection updates the conversation row of the turn without waiting for any lock, and no
  // connection of the archive stays inside a transaction while the turn waits or streams.
  const independentWrite = async (phase: string) => {
    expect(await querySql(testDatabaseServer(), `select count(*)::integer as open from pg_stat_activity
      where datname = $1 and state like 'idle in transaction%'`, [new URL(files.database).pathname.slice(1)]))
      .toEqual([{ open: 0 }]);
    await querySql(files.database, `begin; set local lock_timeout = '50ms';
      update conversations set last_activity_at = last_activity_at;
      insert into independent_writes (phase) values ('${phase}'); commit;`);
  };
  try {
    const client = await ProtocolClient.ready(sessionUrl(port));
    const requestId = client.requestId();
    client.startText(requestId);
    client.chunk(requestId, 'question');
    client.end(requestId);
    await waitingForAgent;
    await querySql(files.database, 'create table independent_writes (id serial primary key, phase text not null)');
    await independentWrite('agent');
    agentGate.release();
    await client.waitFor(message => message.type === 'output.chunk');
    await waitingDuringStream;
    await independentWrite('stream');
    streamGate.release();
    const result = await client.result(requestId);
    expect(result.final.type).toBe('turn.completed');
    expect(result.outputs[0]!.text).toBe('first second');
    expect(await querySql(files.database, 'select phase from independent_writes order by id'))
      .toEqual([{ phase: 'agent' }, { phase: 'stream' }]);
  } finally {
    agentGate.release();
    streamGate.release();
    await closeAllClients();
    await runtime.close();
  }
});

test('restores completed history after restart and uses it for textual continuation', async () => {
  const files = await fixture();
  const port = await freePort();
  const environment = serverEnvironment(files, port);
  const seen: Array<Array<{ text: string; status: string; answer?: string; error?: string }>> = [];
  const firstRuntime = await startConversationServer(environment,
    async () => ({ orchestrator: { async *produce(history) {
      seen.push(history.turns.map(turn => ({ text: turn.text, status: turn.status,
        ...(turn.status === 'answered' ? { answer: turn.answer } : {}),
        ...(turn.status === 'failed' ? { error: turn.error } : {}) })));
      if (seen.length === 1) { yield text('first answer'); yield expectation(); }
      else { yield text('partial'); throw new Error('private provider failure'); }
    } }, async close() {} }));
  let id = '';
  let beforeRestart: { id: string; turns: Array<{ id: string; text: string;
    status: string; answer?: string; error?: string }> } | undefined;
  try {
    const client = await ProtocolClient.ready(sessionUrl(port));
    const unknown = await client.textTurn('unknown', { conversationId: '00000000-0000-4000-8000-000000000000' });
    expect(unknown.final).toMatchObject({ type: 'turn.rejected', reason: 'conversation_not_found',
      message: 'Conversation not found.' });
    expect((await firstRuntime.server.inject({ method: 'GET', url: '/api/v1/conversations' }))
      .json().items).toEqual([]);

    const first = await client.textTurn('first question');
    expect(first.final.type).toBe('turn.completed');
    id = first.accepted!.conversationId as string;
    expect(first.outputs[0]!.text).toBe('first answer');
    const second = await client.textTurn('second question', { conversationId: id });
    expect(second.accepted!.conversationId).toBe(id);
    expect(second.final).toEqual({ type: 'turn.failed', turnId: second.accepted!.turnId, message: failure });
    expect(second.outputs.map(output => output.text)).toEqual(['partial', failure]);
    expect(JSON.stringify(client.json())).not.toContain('private provider failure');
    expect(seen).toEqual([
      [{ text: 'first question', status: 'pending' }],
      [{ text: 'first question', status: 'answered', answer: 'first answer' },
        { text: 'second question', status: 'pending' }],
    ]);
    const history = await firstRuntime.server.inject({ method: 'GET',
      url: `/api/v1/conversations/${id}` });
    expect(history.statusCode).toBe(200);
    beforeRestart = history.json() as typeof beforeRestart;
    expect(id).toMatch(uuidV4);
    expect(beforeRestart?.id).toBe(id);
    expect(beforeRestart?.turns.map(turn => turn.id)).toHaveLength(2);
    for (const turn of beforeRestart?.turns ?? []) expect(turn.id).toMatch(uuidV4);
    expect(new Set([id, ...beforeRestart!.turns.map(turn => turn.id)]).size).toBe(3);
    expect(beforeRestart?.turns.map(turn => [turn.text, turn.status])).toEqual([
      ['first question', 'answered'], ['second question', 'failed'],
    ]);
    expect(beforeRestart?.turns[1]?.error).toBe(failure);
  } finally {
    await closeAllClients();
    await firstRuntime.close();
  }

  const persistedArchive = await openArchive(files.database);
  try {
    expect(await persistedArchive.db.selectFrom('conversations').select('id').execute())
      .toEqual([{ id }]);
    expect((await persistedArchive.db.selectFrom('turns').select('id').orderBy('ordinal').execute())
      .map(turn => turn.id)).toEqual(beforeRestart?.turns.map(turn => turn.id));
  } finally { await persistedArchive.close(); }

  const afterRestartSeen: string[][] = [];
  const restarted = await startConversationServer(environment,
    async () => ({ orchestrator: { async *produce(history) {
      afterRestartSeen.push(history.turns.map(turn => turn.text));
      yield text('third answer');
      yield expectation();
    } }, async close() {} }));
  try {
    const history = await restarted.server.inject({ method: 'GET',
      url: `/api/v1/conversations/${id}` });
    expect(history.statusCode).toBe(200);
    expect(history.json()).toEqual(beforeRestart);
    const client = await ProtocolClient.ready(sessionUrl(port));
    const third = await client.textTurn('third question', { conversationId: id });
    expect(third.final.type).toBe('turn.completed');
    expect(third.outputs[0]!.text).toBe('third answer');
    expect(third.accepted!.conversationId).toBe(id);
    expect(afterRestartSeen).toEqual([['first question', 'second question', 'third question']]);
    const finalHistory = await restarted.server.inject({ method: 'GET',
      url: `/api/v1/conversations/${id}` });
    const persisted = finalHistory.json() as { id: string; turns: Array<{ text: string; status: string }> };
    expect(persisted.id).toBe(id);
    expect(persisted.turns.map(turn => [turn.text, turn.status])).toEqual([
      ['first question', 'answered'], ['second question', 'failed'], ['third question', 'answered'],
    ]);
    expect((await restarted.server.inject({ method: 'GET', url: '/api/v1/conversations' }))
      .json().items).toHaveLength(1);
  } finally {
    await closeAllClients();
    await restarted.close();
  }
});

// Verification: Prova degli ingressi disabilitati durante un turno
test('processes separate conversations in parallel and rejects a second turn in the same conversation', async () => {
  const files = await fixture();
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const firstGate = gate();
  const secondGate = gate();
  let producingFirst!: () => void;
  const firstStarted = new Promise<void>(resolve => { producingFirst = resolve; });
  let producingSecond!: () => void;
  const secondStarted = new Promise<void>(resolve => { producingSecond = resolve; });
  let productions = 0;
  const runtime = await startConversationServer(serverEnvironment(files, port, files.directory),
  async () => ({ orchestrator: { async *produce() {
    productions++;
    if (productions === 1) { producingFirst(); await firstGate.waiting; }
    if (productions === 2) { producingSecond(); await secondGate.waiting; }
    yield text('complete');
    yield expectation();
  } }, async close() {} }));
  try {
    const client = await ProtocolClient.ready(sessionUrl(port));
    const other = await ProtocolClient.ready(sessionUrl(port));
    const active = client.requestId();
    client.startText(active);
    client.chunk(active, 'first');
    client.end(active);
    const accepted = await client.waitFor(message => message.type === 'turn.accepted');
    await firstStarted;
    const id = accepted.conversationId as string;
    const rejected = await other.textTurn('same conversation', { conversationId: id });
    expect(rejected.final).toMatchObject({ type: 'turn.rejected', reason: 'occupied',
      message: 'Another turn is in progress.' });
    const parallel = other.requestId();
    other.startText(parallel);
    other.chunk(parallel, 'new conversation');
    other.end(parallel);
    await secondStarted;
    secondGate.release();
    expect((await other.result(parallel)).final.type).toBe('turn.completed');
    expect(await conversationTurns(origin, id)).toMatchObject([{ text: 'first', status: 'pending' }]);
    firstGate.release();
    expect((await client.result(active)).final.type).toBe('turn.completed');
    expect(await waitForTurn(origin, id, 'answered')).toHaveLength(1);

    const simultaneous = await Promise.all([client.textTurn('one of two'), other.textTurn('other of two')]);
    expect(simultaneous.map(result => result.final.type)).toEqual(['turn.completed', 'turn.completed']);
    expect(productions).toBe(4);
    const after = await fetch(`${origin}/api/v1/conversations`);
    expect((await after.json() as { items: unknown[] }).items).toHaveLength(4);
    const archive = await openArchive(files.database);
    try {
      expect((await archive.db.selectFrom('turns').select('text').execute())
        .map(row => row.text).sort()).toEqual([
        'first', 'new conversation', 'one of two', 'other of two',
      ].sort());
    } finally { await archive.close(); }
  } finally {
    firstGate.release();
    secondGate.release();
    await closeAllClients();
    await runtime.close();
  }
});

test.each(['answered', 'failed'] as const)(
  'persists a %s turn after its session client disconnects', async (outcome) => {
    const files = await fixture();
    const port = await freePort();
        const origin = `http://127.0.0.1:${port}`;
    const continuation = gate();
    const runtime = await startConversationServer(serverEnvironment(files, port, files.directory),
    async () => ({ orchestrator: { async *produce() {
      yield text('partial');
      await continuation.waiting;
      if (outcome === 'failed') throw new Error('private provider failure');
      yield text(' complete');
      yield expectation();
    } }, async close() {} }));
    try {
      const client = await ProtocolClient.ready(sessionUrl(port));
      const requestId = client.requestId();
      client.startText(requestId);
      client.chunk(requestId, 'hello');
      client.end(requestId);
      const accepted = await client.waitFor(message => message.type === 'turn.accepted');
      const chunk = await client.waitFor(message => message.type === 'output.chunk');
      expect(chunk.text).toBe('partial');
      const id = accepted.conversationId as string;
      client.terminate();
      await client.closed;
      continuation.release();
      const turns = await waitForTurn(origin, id, outcome);
      expect(turns).toHaveLength(1);
      expect(turns[0]?.text).toBe('hello');
      if (outcome === 'answered') expect(turns[0]?.answer).toBe('partial complete');
      else {
        expect(turns[0]?.error).toBe(failure);
        expect(JSON.stringify(turns)).not.toContain('private provider failure');
      }
    } finally {
      continuation.release();
      await runtime.close();
    }
  },
);

test.each([
  ['read error', false, false],
  ['missing pending turn', true, false],
  ['read error and failed completion', false, true],
  ['missing pending turn and failed completion', true, true],
] as const)('handles admitted turn with %s', async (_scenario, missing, completionFails) => {
  const files = await fixture();
  const prepared = await prepareConfiguredConversations({ databaseUrl: files.database,
    listPageSize: 20, maxListPageSize: 100, historyTurns: 20, language: 'en', timeZone: 'UTC' }, new Date(), () => undefined);
  let productions = 0;
  const built = await buildConversationServer({ host: '127.0.0.1', port: 3000,
    allowedOrigins: [], publicHttps: false }, prepared,
  { async *produce() { productions++; yield text('must not be produced for the faulty turn'); yield expectation(); } }, undefined, undefined, surfaceOptions());
  const historyFault = vi.spyOn(PostgresConversationHistoryRead.prototype, 'find')
    .mockImplementationOnce(async () => {
      if (missing) return undefined;
      throw new Error('private history failure');
    });
  const completionFault = completionFails
    ? vi.spyOn(PostgresTurnRepository.prototype, 'saveConclusion')
      .mockImplementationOnce(async () => { throw new Error('private completion failure'); })
    : undefined;
  try {
    const port = await listen(built);
    const client = await ProtocolClient.ready(sessionUrl(port));
    const first = await client.textTurn('first');
    expect(first.final).toEqual({ type: 'turn.failed', turnId: first.accepted!.turnId, message: failure });
    expect(first.outputs.map(output => output.text)).toEqual([failure]);
    expect(first.sequence).not.toContain('turn.completed');
    expect(JSON.stringify(client.json())).not.toContain('private');
    expect(productions).toBe(0);
    historyFault.mockRestore();
    completionFault?.mockRestore();
    const id = first.accepted!.conversationId as string;
    const history = await built.server.inject({ method: 'GET',
      url: `/api/v1/conversations/${id}` });
    const turns = (history.json() as { turns: Array<{ status: string; error?: string }> }).turns;
    expect(turns).toHaveLength(1);
    expect(turns[0]?.status).toBe(completionFails ? 'pending' : 'failed');
    if (!completionFails) expect(turns[0]?.error).toBe(failure);
    const next = await client.textTurn('second');
    if (completionFails) {
      expect(next.final).toMatchObject({ type: 'turn.rejected', reason: 'unavailable',
        message: 'Service temporarily unavailable.' });
      expect(productions).toBe(0);
    } else {
      expect(next.final.type).toBe('turn.completed');
      expect(productions).toBe(1);
    }
  } finally {
    historyFault.mockRestore();
    completionFault?.mockRestore();
    await closeAllClients();
    await built.turnIngress.closeSessions();
    await built.server.close();
    await prepared.archive.close();
  }
  if (completionFails) {
    const recovered = await prepareConfiguredConversations({ databaseUrl: files.database,
      listPageSize: 20, maxListPageSize: 100, historyTurns: 20, language: 'en', timeZone: 'UTC' }, new Date(), () => undefined);
    const restarted = await buildConversationServer({ host: '127.0.0.1', port: 3000,
      allowedOrigins: [], publicHttps: false }, recovered,
    { async *produce() { yield text('after restart'); yield expectation(); } }, undefined, undefined, surfaceOptions());
    try {
      expect(recovered.recoveredTurns).toBe(1);
      expect(await recovered.archive.db.selectFrom('turns').select('status').execute())
        .toEqual([{ status: 'interrupted' }]);
      const port = await listen(restarted);
      const next = await (await ProtocolClient.ready(sessionUrl(port))).textTurn('after restart');
      expect(next.final.type).toBe('turn.completed');
      expect(next.outputs[0]!.text).toBe('after restart');
    } finally {
      await closeAllClients();
      await restarted.turnIngress.closeSessions();
      await restarted.server.close();
      await recovered.archive.close();
    }
  }
});

test('does not confirm success when the answer transaction cannot commit', async () => {
  const files = await fixture();
  const prepared = await prepareConfiguredConversations({ databaseUrl: files.database,
    listPageSize: 20, maxListPageSize: 100, historyTurns: 20, language: 'en', timeZone: 'UTC' }, new Date(), () => undefined);
  await querySql(files.database, `create function reject_answer_release() returns trigger language plpgsql
    as $$ begin raise exception 'injected'; end $$;
    create trigger reject_answer_release before update on conversations for each row
    when (new.active_turn_id is null) execute function reject_answer_release();`);
  const built = await buildConversationServer({ host: '127.0.0.1', port: 3000,
    allowedOrigins: [], publicHttps: false }, prepared,
  { async *produce() { yield text('partial answer'); yield expectation(); } }, undefined, undefined, surfaceOptions());
  try {
    const port = await listen(built);
    const client = await ProtocolClient.ready(sessionUrl(port));
    const result = await client.textTurn('question');
    expect(result.outputs.map(output => output.text)).toEqual(['partial answer', failure]);
    expect(result.final).toEqual({ type: 'turn.failed', turnId: result.accepted!.turnId, message: failure });
    expect(client.json().some(message => message.type === 'turn.completed')).toBe(false);
    expect(await prepared.archive.db.selectFrom('turns')
      .select(['status', 'answer', 'finished_at']).executeTakeFirst())
      .toEqual({ status: 'pending', answer: null, finished_at: null });
    const pending = await prepared.archive.db.selectFrom('turns').select(['id', 'conversation_id']).executeTakeFirstOrThrow();
    expect(await prepared.archive.db.selectFrom('conversations')
      .select('active_turn_id').where('id', '=', pending.conversation_id).executeTakeFirst())
      .toEqual({ active_turn_id: pending.id });
  } finally {
    await closeAllClients();
    await built.turnIngress.closeSessions();
    await built.server.close();
    await prepared.archive.close();
  }
});

test('invalid agent files prevent the conversation listener from starting', async () => {
  const files = await fixture();
  const port = await freePort();
  await writeAgentFile(join(files.directory, 'orchestrator.json'), '{');
  await writeAgentFile(join(files.directory, 'generic.json'), JSON.stringify({ description: 'Answers.',
    instructions: 'Answer.', llm: { provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'generic-key' } }));
  await expect(startConversationServer(serverEnvironment(files, port, files.directory)))
    .rejects.toThrow('Invalid agent configuration: orchestrator');
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});

test('starts on an archive already migrated without reapplying its migrations and preserves its history', async () => {
  const files = await fixture();
  const port = await freePort();
  const priorConversationId = 'dc89cb5e-e695-43cc-8a04-917316771ea4';
  const priorTurnId = '79e437a8-c11a-48ba-b476-e4fd4712ea58';
  const archive = await openArchive(files.database);
  try {
    await archive.db.insertInto('conversations').values({
      id: priorConversationId, created_at: new Date(1234), last_activity_at: new Date(1234), active_turn_id: null,
    }).execute();
    await archive.db.insertInto('turns').values({ id: priorTurnId, conversation_id: priorConversationId,
      text: 'old question', accepted_at: new Date(1234), status: 'answered', answer: 'old answer',
      error: null, finished_at: new Date(2345), ordinal: 1, agent: null, actions: null,
    }).execute();
  } finally { await archive.close(); }
  const applied = await querySql(files.database, 'select name, timestamp from kysely_migration order by name');
  expect(applied.map(row => row.name)).toEqual(['001_initial']);

  const runtime = await startConversationServer(serverEnvironment(files, port, files.directory),
  async () => ({ orchestrator: { async *produce() { yield text('new answer'); yield expectation(); } },
    async close() {} }));
  try {
    expect(await querySql(files.database, 'select name, timestamp from kysely_migration order by name')).toEqual(applied);
    const origin = `http://127.0.0.1:${port}`;
    const history = await fetch(`${origin}/api/v1/conversations/${priorConversationId}`);
    expect(history.status).toBe(200);
    expect((await history.json() as { turns: Array<{ id: string; text: string; answer: string }> }).turns)
      .toMatchObject([{ id: priorTurnId, text: 'old question', answer: 'old answer' }]);
    const client = await ProtocolClient.ready(sessionUrl(port));
    const next = await client.textTurn('new question', { conversationId: priorConversationId });
    expect(next.final.type).toBe('turn.completed');
    const updated = await fetch(`${origin}/api/v1/conversations/${priorConversationId}`);
    expect((await updated.json() as { turns: Array<{ text: string }> }).turns.map(turn => turn.text))
      .toEqual(['old question', 'new question']);
  } finally {
    await closeAllClients();
    await runtime.close();
  }
});

// Verification: Prova delle azioni nello storico
test('stores the actions of a reply without sending them to clients', async () => {
  const files = await fixture();
  const port = await freePort();
  const runtime = await startConversationServer(serverEnvironment(files, port, files.directory),
  async () => ({ orchestrator: { async *produce() {
    yield { kind: 'agent', agent: 'home' };
    yield { kind: 'action', action: { tool: 'HassTurnOn', input: { name: 'secret-device' }, output: { ok: true } } };
    yield text('Ho acceso la luce.'); yield expectation();
  } }, async close() {} }));
  try {
    const client = await ProtocolClient.ready(sessionUrl(port));
    const result = await client.textTurn('accendi la luce');
    expect(result.final.type).toBe('turn.completed');
    expect(JSON.stringify(result)).not.toMatch(/HassTurnOn|secret-device/);
    const conversationId = (result.accepted as unknown as { conversationId: string }).conversationId;
    const history = await (await fetch(`http://127.0.0.1:${port}/api/v1/conversations/${conversationId}`)).text();
    expect(history).toContain('Ho acceso la luce.');
    expect(history).not.toMatch(/HassTurnOn|secret-device|actions/);
  } finally {
    await closeAllClients();
    await runtime.close();
  }
  expect(await querySql(files.database, 'select actions, pg_typeof(actions)::text as type from turns')).toEqual([{
    actions: [{ tool: 'HassTurnOn', input: { name: 'secret-device' }, output: { ok: true } }], type: 'jsonb' }]);
});

test('a failed archive migration prevents the conversation listener', async () => {
  const files = await fixture();
  const port = await freePort();
  // A table of another program with a name of the archive makes the first migration fail.
  await querySql(files.database, 'create table turns (conflicting text)');
  let agentClosed = false;
  await expect(startConversationServer(serverEnvironment(files, port, files.directory),
  async () => ({ orchestrator: { async *produce() { yield text('unused'); yield expectation(); } },
    async close() { agentClosed = true; } }))).rejects.toThrow();
  expect(agentClosed).toBe(true);
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});

// Verification: Prova della scelta dell'agente da parte dell'orchestratore
test('a session turn delegates to a configured MCP tool and persists the answer', async () => {
  const files = await fixture();
  const agentDirectory = join(files.directory, 'agents');
  await mkdir(agentDirectory);
  const port = await freePort();
  const calls: string[] = [];
  const mcpServer = createHttpServer(async (request, reply) => {
    let body = '';
    for await (const chunk of request) body += chunk.toString();
    const rpc = body ? JSON.parse(body) as { id?: number; method?: string;
      params?: { name?: string } } : {};
    if (rpc.method === 'notifications/initialized') { reply.writeHead(202).end(); return; }
    const result = rpc.method === 'initialize'
      ? { protocolVersion: '2025-11-25', capabilities: { tools: {} },
        serverInfo: { name: 'controlled-mcp', version: '1.0.0' } }
      : rpc.method === 'tools/list'
        ? { tools: [{ name: 'lookup', description: 'Look up a fact',
          inputSchema: { type: 'object', properties: { key: { type: 'string' } } } }] }
        : rpc.method === 'tools/call'
          ? { content: [{ type: 'text', text: 'fact from MCP' }] } : undefined;
    if (rpc.method === 'tools/call') calls.push(rpc.params?.name ?? '');
    if (!result) { reply.writeHead(404).end(); return; }
    reply.writeHead(200, { 'content-type': 'application/json' });
    reply.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  await new Promise<void>((resolve) => mcpServer.listen(0, '127.0.0.1', resolve));
  const address = mcpServer.address();
  if (!address || typeof address === 'string') throw new Error('No MCP port');
  const llm = { provider: 'mistral', model: 'controlled-model', apiKey: 'fake-key' };
  await writeAgentFile(join(agentDirectory, 'orchestrator.json'), JSON.stringify({
    instructions: 'Delegate fact lookups.', llm,
  }));
  await writeAgentFile(join(agentDirectory, 'facts.json'), JSON.stringify({
    instructions: 'Use lookup.', description: 'Find facts.', maxToolCalls: 1, llm,
    mcp: { url: `http://127.0.0.1:${address.port}/mcp` },
  }));
  const modelRequests: Array<{ model: string; instructions: string }> = [];
  const routerPrompts: unknown[] = [];
  let orchestratorStep = 0;
  let runtime: Awaited<ReturnType<typeof startConversationServer>> | undefined;
  // The adapter appends the reply-format guidance to the configured instructions.
  const configuredInstructions = (prompt: unknown) => String(prompt ?? '').split('\n')[0]!;
  const prepareAgents = async (directory: string) => {
    const configs = await loadAgentConfigs(directory, testEnvironment());
    const config = configs.specialists[0]!;
    const mcp = await McpToolClient.connect(config.mcp!);
    try {
      const tools = await mcp.listTools();
      let specialistStep = 0;
      const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined,
        cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
      const finish = (reason: 'stop' | 'tool-calls') => ({ type: 'finish',
        finishReason: { unified: reason, raw: undefined }, usage });
      const answer = (value: string) => [{ type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: value }, { type: 'text-end', id: 'text-1' }];
      const specialistModel = new MockLanguageModelV4({ modelId: 'controlled-model',
        doStream: async (request) => {
          modelRequests.push({ model: 'controlled-model',
            instructions: configuredInstructions(request.prompt[0]?.content) });
          const step = specialistStep++;
          return { stream: simulateReadableStream({ chunks: step % 3 === 0 ? [
            { type: 'tool-call', toolCallId: 'tool-1', toolName: 'lookup',
              input: '{"key":"answer"}' }, finish('tool-calls'),
          ] as any[] : [...answer(step % 3 === 1 ? 'Answer from tool.' : 'Second answer.'), finish('stop')] as any[] }) };
        } });
      const specialist = new AiSdkToolAgentReply({ provider: config.llm.provider, instructions: config.instructions,
        model: config.llm.model, apiKey: config.llm.apiKey },
        { tools, prompts: [] }, mcp, config.maxToolCalls!, specialistModel);
      const orchestratorModel = new MockLanguageModelV4({ modelId: 'controlled-model',
        doGenerate: async (request) => {
          modelRequests.push({ model: 'controlled-model',
            instructions: configuredInstructions(request.prompt[0]?.content) });
          routerPrompts.push(request.prompt.slice(1));
          expect(String(request.prompt[0]?.content)).toContain('- facts: Find facts.');
          orchestratorStep++;
          return { content: [{ type: 'text', text: '{"agent":"facts"}' }], warnings: [],
            finishReason: { unified: 'stop', raw: undefined }, usage } as any;
        } });
      const orchestrator = new AiSdkOrchestratorReply({
        provider: configs.orchestrator.llm.provider, instructions: configs.orchestrator.instructions, model: configs.orchestrator.llm.model,
        apiKey: configs.orchestrator.llm.apiKey,
      }, [{ id: config.id, description: config.description!, reply: specialist }],
      orchestratorModel);
      return { orchestrator, close: () => mcp.close() };
    } catch (error) { await mcp.close(); throw error; }
  };
  try {
    runtime = await startConversationServer(serverEnvironment(files, port, agentDirectory), prepareAgents);
    const client = await ProtocolClient.ready(sessionUrl(port));
    const delegated = await client.textTurn('What is the answer?');
    expect(delegated.final).toMatchObject({ type: 'turn.completed', expectsReply: false });
    expect(delegated.outputs.map(output => output.text)).toEqual(['Answer from tool.']);
    expect(calls).toEqual(['lookup']);
    const id = delegated.accepted!.conversationId as string;
    const list = await fetch(`http://127.0.0.1:${port}/api/v1/conversations`);
    expect((await list.json() as { items: Array<{ id: string }> }).items.map(item => item.id)).toEqual([id]);
    const second = await client.textTurn('And the next one?', { conversationId: id });
    expect(second.final.type).toBe('turn.completed');
    expect(second.outputs[0]!.text).toBe('Second answer.');
    expect(calls).toEqual(['lookup']);
    expect(modelRequests).toEqual([
      { model: 'controlled-model', instructions: 'Delegate fact lookups.' },
      { model: 'controlled-model', instructions: 'Use lookup.' },
      { model: 'controlled-model', instructions: 'Use lookup.' },
      { model: 'controlled-model', instructions: 'Delegate fact lookups.' },
      { model: 'controlled-model', instructions: 'Use lookup.' },
    ]);
    // Verification: Prova della continuità dell'agente nella conversazione
    // The router sees which agent answered the stored turn; clients never do.
    expect(routerPrompts[1]).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'What is the answer?' }] },
      { role: 'assistant', content: [{ type: 'text', text: '[agent: facts] Answer from tool.' }] },
      { role: 'user', content: [{ type: 'text', text: 'And the next one?' }] },
    ]);
    expect(JSON.stringify([delegated, second])).not.toContain('facts');
    const history = await fetch(`http://127.0.0.1:${port}/api/v1/conversations/${id}`);
    const historyBody = await history.json() as { turns: Array<Record<string, unknown>> };
    expect(historyBody.turns.map((turn) => turn.answer)).toEqual(['Answer from tool.', 'Second answer.']);
    expect(historyBody.turns.every((turn) => !('agent' in turn))).toBe(true);
    await client.close();
    await runtime.close();
    runtime = undefined;
    await writeAgentFile(join(agentDirectory, 'facts.json'), JSON.stringify({
      instructions: 'Use the updated lookup.', description: 'Find facts.', maxToolCalls: 1, llm,
      mcp: { url: `http://127.0.0.1:${address.port}/mcp` },
    }));
    orchestratorStep = 0;
    modelRequests.length = 0;
    runtime = await startConversationServer(serverEnvironment(files, port, agentDirectory), prepareAgents);
    const changed = await (await ProtocolClient.ready(sessionUrl(port))).textTurn('Look up the updated fact.');
    expect(changed.final.type).toBe('turn.completed');
    expect(changed.outputs[0]!.text).toBe('Answer from tool.');
    expect(modelRequests).toEqual([
      { model: 'controlled-model', instructions: 'Delegate fact lookups.' },
      { model: 'controlled-model', instructions: 'Use the updated lookup.' },
      { model: 'controlled-model', instructions: 'Use the updated lookup.' },
    ]);
    expect(calls).toEqual(['lookup', 'lookup']);
  } finally {
    await closeAllClients();
    await runtime?.close();
    await new Promise<void>((resolve) => mcpServer.close(() => resolve()));
  }
});

test('unavailable configured MCP connector prevents the conversation listener', async () => {
  const files = await fixture();
  const agentDirectory = join(files.directory, 'agents');
  await mkdir(agentDirectory);
  const port = await freePort();
  const unavailablePort = await freePort();
  const llm = { provider: 'mistral', model: 'controlled-model', apiKey: 'fake-key' };
  await writeAgentFile(join(agentDirectory, 'orchestrator.json'), JSON.stringify({
    instructions: 'Delegate.', llm,
  }));
  await writeAgentFile(join(agentDirectory, 'facts.json'), JSON.stringify({
    instructions: 'Use lookup.', description: 'Find facts.', maxToolCalls: 1, llm,
    mcp: { url: `http://127.0.0.1:${unavailablePort}/mcp` },
  }));
  await expect(startConversationServer(serverEnvironment(files, port, agentDirectory)))
    .rejects.toThrow('MCP connection failed');
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});

// Verification: Prova delle configurazioni degli agenti con e senza MCP
test('a directory without specialist agents prevents the conversation listener', async () => {
  const files = await fixture();
  const agentDirectory = join(files.directory, 'agents');
  await mkdir(agentDirectory);
  const port = await freePort();
  await writeAgentFile(join(agentDirectory, 'orchestrator.json'), JSON.stringify({
    instructions: 'Choose.', llm: { provider: 'mistral', model: 'controlled-model', apiKey: 'fake-key' },
  }));
  await expect(startConversationServer(serverEnvironment(files, port, agentDirectory)))
    .rejects.toThrow('No specialist agent configured');
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
});

async function expectPortAvailable(port: number): Promise<void> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
}

const controlledAgents = async () => ({ orchestrator: { async *produce() {
  yield text('ok'); yield expectation();
} }, async close() {} });

// Verification: Prova della configurazione esplicita del listener HTTP
// Verification: Prova dell'archivio configurato all'avvio
test('does not open a listener when the HTTP or archive configuration is missing or invalid', async () => {
  const files = await fixture();
  const port = await freePort();
  // Variables of other programs, such as PORT and HOST, are not read.
  const environment = { ...serverEnvironment(files, port), PORT: String(port + 1), HOST: '0.0.0.0',
    AMBROGIO_ENV: 'production' };
  const start = (env: NodeJS.ProcessEnv) => startConversationServer(env, controlledAgents);
  for (const name of ['AMBROGIO_HTTP_HOST', 'AMBROGIO_HTTP_PORT', 'AMBROGIO_PUBLIC_HTTPS', 'AMBROGIO_DATABASE_URL']) {
    await expect(start({ ...environment, [name]: undefined })).rejects.toThrow(`Missing environment variable ${name}`);
    await expectPortAvailable(port);
  }
  for (const value of ['0', '65536', 'port']) {
    await expect(start({ ...environment, AMBROGIO_HTTP_PORT: value }))
      .rejects.toThrow('Invalid environment variable AMBROGIO_HTTP_PORT');
    await expectPortAvailable(port);
  }
  const url = new URL(files.database);
  const withoutDatabase = new URL(url); withoutDatabase.pathname = '/';
  const withParameters = `${files.database}?sslmode=disable`;
  for (const value of ['', 'mysql://postgres@127.0.0.1:5432/ambrogio', withoutDatabase.toString(), withParameters]) {
    const failure = await start({ ...environment, AMBROGIO_DATABASE_URL: value }).catch((error: unknown) => error);
    expect((failure as Error).message).toBe(value === '' ? 'Missing environment variable AMBROGIO_DATABASE_URL'
      : 'Invalid environment variable AMBROGIO_DATABASE_URL: expected a PostgreSQL URL without parameters');
    if (value !== '') expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toContain(value);
    await expectPortAvailable(port);
  }
  // A database that does not exist on the test server: the archive cannot be prepared and no table is created.
  const missing = new URL(url); missing.pathname = '/ambrogio_test_0000000000000000';
  await expect(start({ ...environment, AMBROGIO_DATABASE_URL: missing.toString() })).rejects.toThrow();
  await expectPortAvailable(port);
  expect(await publicTables(files.database)).toEqual([]);
});

// Verification: Prova della configurazione esplicita del listener HTTP
// Verification: Prova dell'archivio configurato all'avvio
test('listens on the configured address and serves the configured archive after recovering pending turns', async () => {
  const files = await fixture();
  const archive = await openArchive(files.database);
  await archive.db.insertInto('conversations').values({ id: '0a0f1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b', created_at: new Date(100),
    last_activity_at: new Date(100), active_turn_id: null }).execute();
  await archive.db.insertInto('turns').values({ id: '1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e', conversation_id: '0a0f1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b',
    ordinal: 1, text: 'hello', accepted_at: new Date(100), status: 'pending', answer: null,
    error: null, finished_at: null, agent: null, actions: null }).execute();
  await archive.db.updateTable('conversations').set({ active_turn_id: '1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e' })
    .where('id', '=', '0a0f1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b').execute();
  await archive.close();
  const destroy = vi.spyOn(Object.getPrototypeOf(archive.db) as { destroy: () => Promise<void> }, 'destroy');

  const port = await freePort();
  const runtime = await startConversationServer(serverEnvironment(files, port, files.directory), controlledAgents);
  const address = runtime.server.server.address();
  expect(address && typeof address !== 'string' && address.address).toBe('127.0.0.1');
  expect(address && typeof address !== 'string' && address.port).toBe(port);
  try {
    const origin = `http://127.0.0.1:${port}`;
    const list = await fetch(`${origin}/api/v1/conversations`);
    expect(list.status).toBe(200);
    expect((await list.json() as { items: { id: string }[] }).items).toEqual([
      { id: '0a0f1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b', lastActivityAt: new Date(100).toISOString() },
    ]);
    const history = await fetch(`${origin}/api/v1/conversations/0a0f1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b`);
    expect(history.status).toBe(200);
    expect((await history.json() as { turns: { status: string }[] }).turns[0]?.status).toBe('interrupted');
  } finally {
    await runtime.close();
    expect(destroy).toHaveBeenCalledTimes(1);
    destroy.mockRestore();
    expect(runtime.server.server.listening).toBe(false);
    await expectPortAvailable(port);
  }
});
