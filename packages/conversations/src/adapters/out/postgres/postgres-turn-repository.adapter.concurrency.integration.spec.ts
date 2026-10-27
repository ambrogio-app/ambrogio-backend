// Concurrency guarantees of the turn repository, proven by independent processes, each with its own
// PostgreSQL pool, on one test database; the test synchronizes them explicitly and a separate connection
// checks the final state («Prova delle garanzie di concorrenza con esecuzioni reali»).
import { fork, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migratedTestDatabase } from '../../../../../../test/support/test-database.js';
import type { TemporaryDatabase } from './temporary-database.js';
import { lockTimeoutMs } from './postgres-transaction.js';
import type { ProcessReply, ProcessRequest } from '../../../../test/support/turn-repository-process.js';

const worker = fileURLToPath(new URL('../../../../test/support/turn-repository-process.ts', import.meta.url));

/** One independent process, answering one request at a time. */
class Peer {
  readonly #child: ChildProcess;
  #pending: ((reply: ProcessReply) => void)[] = [];
  readonly ready: Promise<void>;

  constructor() {
    this.#child = fork(worker, [], { execArgv: ['--disable-warning=ExperimentalWarning'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let started!: () => void;
    this.ready = new Promise(resolve => { started = resolve; });
    this.#pending.push(() => started());
    this.#child.on('message', (reply: ProcessReply) => this.#pending.shift()?.(reply));
  }

  request(message: ProcessRequest): Promise<ProcessReply> {
    return new Promise(resolve => {
      this.#pending.push(resolve);
      this.#child.send(message);
    });
  }

  async result(message: ProcessRequest): Promise<unknown> {
    const reply = await this.request(message);
    if (!reply.ok) throw new Error(`peer fault: ${reply.fault}`);
    return reply.result;
  }

  async close(): Promise<void> {
    if (!this.#child.connected) return;
    const exited = new Promise(resolve => this.#child.once('exit', resolve));
    await this.request({ op: 'close' });
    await exited;
  }
}

let database: TemporaryDatabase;
let peers: Peer[];

/** A connection independent of the processes under test. */
async function connection(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: database.url });
  await client.connect();
  return client;
}

async function probe<T>(read: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = await connection();
  try { return await read(client); } finally { await client.end(); }
}

const turnsOf = (conversationId: string) => probe(async client => (await client.query<{
  id: string; status: string; answer: string | null;
}>('select id, status, answer from turns where conversation_id = $1 order by ordinal', [conversationId])).rows);
const occupantOf = (conversationId: string) => probe(async client => (await client.query<{ active_turn_id: string | null }>(
  'select active_turn_id from conversations where id = $1', [conversationId])).rows[0]!.active_turn_id);

/** Another transaction holding the row lock of a conversation, as a competing admission does. */
async function lockConversation(conversationId: string): Promise<() => Promise<void>> {
  const client = await connection();
  await client.query('begin');
  await client.query('select id from conversations where id = $1 for update', [conversationId]);
  return async () => { await client.query('commit'); await client.end(); };
}

/** A conversation created and concluded by the first peer, so it exists and is free. */
async function freeConversation(): Promise<string> {
  const conversationId = randomUUID();
  const turnId = randomUUID();
  expect(await peers[0]!.result({ op: 'admit', conversationId, turnId, conversation: 'new', at: 1000 })).toEqual({ ok: true });
  expect(await peers[0]!.result({ op: 'load', turnId })).toBe('pending');
  expect(await peers[0]!.result({ op: 'answer', turnId, at: 1001 })).toEqual({ ok: true });
  return conversationId;
}

/** A conversation with one pending turn, admitted by the first peer. */
async function pendingTurn(): Promise<Readonly<{ conversationId: string; turnId: string }>> {
  const conversationId = randomUUID();
  const turnId = randomUUID();
  expect(await peers[0]!.result({ op: 'admit', conversationId, turnId, conversation: 'new', at: 1000 })).toEqual({ ok: true });
  return { conversationId, turnId };
}

beforeAll(async () => {
  database = await migratedTestDatabase();
  peers = [new Peer(), new Peer()];
  await Promise.all(peers.map(peer => peer.ready));
  const pids = await Promise.all(peers.map(peer => peer.result({ op: 'open', url: database.url })));
  expect(new Set([process.pid, ...pids]).size).toBe(3);
}, 30_000);

afterAll(async () => {
  await Promise.all((peers ?? []).map(peer => peer.close()));
  await database?.drop();
});

describe('turn repository under concurrent processes', () => {
  it('admits one turn per conversation when both processes checked it first and admit in turn', async () => {
    const conversationId = await freeConversation();
    const [first, second] = [randomUUID(), randomUUID()];
    // Both preliminary checks happen before either admission: the check is not a reservation.
    expect(await peers[0]!.result({ op: 'exists', conversationId })).toBe(true);
    expect(await peers[1]!.result({ op: 'exists', conversationId })).toBe(true);
    expect(await peers[0]!.result({ op: 'admit', conversationId, turnId: first, conversation: 'existing', at: 2000 }))
      .toEqual({ ok: true });
    expect(await peers[1]!.result({ op: 'admit', conversationId, turnId: second, conversation: 'existing', at: 2001 }))
      .toEqual({ ok: false, error: { kind: 'conversation_occupied' } });
    expect((await turnsOf(conversationId)).map(turn => [turn.id, turn.status]).slice(1)).toEqual([[first, 'pending']]);
    expect(await occupantOf(conversationId)).toBe(first);
  });

  it('admits one turn per conversation when both processes admit at the same agreed instant', async () => {
    for (let round = 0; round < 8; round += 1) {
      const conversationId = await freeConversation();
      const ids = [randomUUID(), randomUUID()];
      for (const peer of peers) expect(await peer.result({ op: 'exists', conversationId })).toBe(true);
      const startAt = Date.now() + 150;
      const replies = await Promise.all(peers.map((peer, index) => peer.result({
        op: 'admit', conversationId, turnId: ids[index]!, conversation: 'existing', at: 2000 + round, startAt,
      }))) as { ok: boolean; error?: { kind: string } }[];
      const winners = replies.flatMap((reply, index) => reply.ok ? [ids[index]!] : []);
      expect(winners, `round ${round}`).toHaveLength(1);
      // The later admission waits for the row lock and then reads the occupancy of the winner.
      expect(replies.filter(reply => !reply.ok)).toEqual([{ ok: false, error: { kind: 'conversation_occupied' } }]);
      const stored = (await turnsOf(conversationId)).slice(1);
      expect(stored.map(turn => [turn.id, turn.status]), `round ${round}`).toEqual([[winners[0], 'pending']]);
      expect(await occupantOf(conversationId)).toBe(winners[0]);
    }
  });

  it('admits a turn when another transaction releases the conversation row within the lock timeout', async () => {
    const conversationId = await freeConversation();
    const turnId = randomUUID();
    const release = await lockConversation(conversationId);
    const released = new Promise<void>(resolve => setTimeout(() => { void release().then(resolve); }, 200));
    expect(await peers[0]!.result({ op: 'admit', conversationId, turnId, conversation: 'existing', at: 3000 }))
      .toEqual({ ok: true });
    await released;
    expect((await turnsOf(conversationId)).map(turn => [turn.id, turn.status]).slice(1)).toEqual([[turnId, 'pending']]);
    expect(await occupantOf(conversationId)).toBe(turnId);
  });

  it('answers archive_busy and stores nothing when the conversation row stays locked beyond the lock timeout', async () => {
    const conversationId = await freeConversation();
    const turnId = randomUUID();
    const release = await lockConversation(conversationId);
    try {
      expect(await peers[0]!.result({ op: 'admit', conversationId, turnId, conversation: 'existing', at: 3001 }))
        .toEqual({ ok: false, error: { kind: 'archive_busy' } });
    } finally {
      await release();
    }
    expect((await turnsOf(conversationId)).slice(1)).toEqual([]);
    expect(await occupantOf(conversationId)).toBeNull();
  }, lockTimeoutMs + 10_000);

  it('keeps the first saved outcome when both processes loaded the pending turn and save in turn', async () => {
    const { conversationId, turnId } = await pendingTurn();
    // Both decisional reads happen before either write: the lost update is the case under test.
    for (const peer of peers) expect(await peer.result({ op: 'load', turnId })).toBe('pending');
    const winner = await peers[0]!.result({ op: 'answer', turnId, at: 3000 });
    const loser = await peers[1]!.result({ op: 'interrupt', turnId, at: 3001 });
    expect([winner, loser]).toEqual([{ ok: true, value: undefined }, { ok: false, error: { kind: 'turn_already_closed' } }]);
    const [stored] = await turnsOf(conversationId);
    expect(stored).toMatchObject({ id: turnId, status: 'answered' });
    expect(stored!.answer).toMatch(/^answer from \d+$/);
    expect(await occupantOf(conversationId)).toBeNull();
  });

  it('saves one outcome only when both processes save the loaded turn at the same agreed instant', async () => {
    for (let round = 0; round < 8; round += 1) {
      const { conversationId, turnId } = await pendingTurn();
      for (const peer of peers) expect(await peer.result({ op: 'load', turnId })).toBe('pending');
      const startAt = Date.now() + 150;
      const replies = await Promise.all([
        peers[0]!.request({ op: 'answer', turnId, at: 3000, startAt }),
        peers[1]!.request({ op: 'interrupt', turnId, at: 3001, startAt }),
      ]);
      const saved = replies.map(reply => reply.ok && (reply.result as { ok: boolean }).ok);
      expect(saved.filter(Boolean), `round ${round}`).toHaveLength(1);
      // The later update waits for the first commit, re-evaluates its condition and changes no row.
      expect(replies[saved.indexOf(false)]).toEqual({ ok: true, result: { ok: false, error: { kind: 'turn_already_closed' } } });
      const [stored] = await turnsOf(conversationId);
      expect(stored!.status, `round ${round}`).toBe(saved[0] ? 'answered' : 'interrupted');
      expect(await occupantOf(conversationId)).toBeNull();
    }
  });
});
