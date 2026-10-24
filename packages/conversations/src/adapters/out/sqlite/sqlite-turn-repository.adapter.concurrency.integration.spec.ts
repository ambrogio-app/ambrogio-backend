// Concurrency guarantees of the turn repository, proven by independent processes, each with its own
// SQLite connection, on one archive file; the test synchronizes them explicitly and a separate read-only
// connection checks the final state («Prova delle garanzie di concorrenza con esecuzioni reali»).
import { fork, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateConversationArchive } from './migrations.js';
import type { ConversationDatabase } from './schema.js';
import { commitLockWaitMs } from './sqlite-transaction.js';
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

let directory: string;
let file: string;
let peers: Peer[];

/** A read-only connection independent of the processes under test. */
function probe<T>(read: (db: Database.Database) => T): T {
  const db = new Database(file, { readonly: true });
  try { return read(db); } finally { db.close(); }
}

const turnsOf = (conversationId: string) => probe(db => db.prepare(
  'select id, status, answer from turns where conversation_id = ? order by ordinal').all(conversationId)) as
  { id: string; status: string; answer: string | null }[];
const occupantOf = (conversationId: string) => probe(db => (db.prepare(
  'select active_turn_id from conversations where id = ?').get(conversationId) as { active_turn_id: string | null }).active_turn_id);

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
  directory = mkdtempSync(join(tmpdir(), 'ambrogio-concurrency-'));
  file = join(directory, 'conversations.sqlite');
  const db = new Kysely<ConversationDatabase>({ dialect: new SqliteDialect({ database: new Database(file) }) });
  await migrateConversationArchive(db);
  await db.destroy();
  peers = [new Peer(), new Peer()];
  await Promise.all(peers.map(peer => peer.ready));
  const pids = await Promise.all(peers.map(peer => peer.result({ op: 'open', file })));
  expect(new Set([process.pid, ...pids]).size).toBe(3);
}, 30_000);

afterAll(async () => {
  await Promise.all((peers ?? []).map(peer => peer.close()));
  rmSync(directory, { recursive: true, force: true });
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
    expect(turnsOf(conversationId).map(turn => [turn.id, turn.status]).slice(1)).toEqual([[first, 'pending']]);
    expect(occupantOf(conversationId)).toBe(first);
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
      for (const reply of replies.filter(reply => !reply.ok)) {
        expect(['conversation_occupied', 'archive_busy']).toContain(reply.error!.kind);
      }
      const stored = turnsOf(conversationId).slice(1);
      expect(stored.map(turn => [turn.id, turn.status]), `round ${round}`).toEqual([[winners[0], 'pending']]);
      expect(occupantOf(conversationId)).toBe(winners[0]);
    }
  });

  it('commits an admission after a read lock of another connection is released within the wait', async () => {
    const conversationId = await freeConversation();
    const turnId = randomUUID();
    // An independent connection holds a read lock, as a reader does for the length of one statement.
    const reader = new Database(file, { readonly: true });
    reader.exec('begin');
    reader.prepare('select count(*) from turns').get();
    const released = new Promise<void>(resolve => setTimeout(() => { reader.exec('commit'); reader.close(); resolve(); }, 200));
    expect(await peers[0]!.result({ op: 'admit', conversationId, turnId, conversation: 'existing', at: 3000 }))
      .toEqual({ ok: true });
    await released;
    expect(turnsOf(conversationId).map(turn => [turn.id, turn.status]).slice(1)).toEqual([[turnId, 'pending']]);
    expect(occupantOf(conversationId)).toBe(turnId);
  });

  it('answers archive_busy and stores nothing when a read lock outlasts the commit wait', async () => {
    const conversationId = await freeConversation();
    const turnId = randomUUID();
    const reader = new Database(file, { readonly: true });
    reader.exec('begin');
    reader.prepare('select count(*) from turns').get();
    try {
      expect(await peers[0]!.result({ op: 'admit', conversationId, turnId, conversation: 'existing', at: 3001 }))
        .toEqual({ ok: false, error: { kind: 'archive_busy' } });
    } finally {
      reader.exec('commit');
      reader.close();
    }
    expect(turnsOf(conversationId).slice(1)).toEqual([]);
    expect(occupantOf(conversationId)).toBeNull();
  }, commitLockWaitMs + 10_000);

  it('keeps the first saved outcome when both processes loaded the pending turn and save in turn', async () => {
    const { conversationId, turnId } = await pendingTurn();
    // Both decisional reads happen before either write: the lost update is the case under test.
    for (const peer of peers) expect(await peer.result({ op: 'load', turnId })).toBe('pending');
    const winner = await peers[0]!.result({ op: 'answer', turnId, at: 3000 });
    const loser = await peers[1]!.result({ op: 'interrupt', turnId, at: 3001 });
    expect([winner, loser]).toEqual([{ ok: true, value: undefined }, { ok: false, error: { kind: 'turn_already_closed' } }]);
    const [stored] = turnsOf(conversationId);
    expect(stored).toMatchObject({ id: turnId, status: 'answered' });
    expect(stored!.answer).toMatch(/^answer from \d+$/);
    expect(occupantOf(conversationId)).toBeNull();
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
      const loser = replies[saved.indexOf(false)]!;
      // The loser either finds the turn closed or meets the held lock as a technical fault: never a success.
      if (loser.ok) expect(loser.result).toEqual({ ok: false, error: { kind: 'turn_already_closed' } });
      else expect(loser.fault).toMatch(/locked|busy/i);
      const [stored] = turnsOf(conversationId);
      expect(stored!.status, `round ${round}`).toBe(saved[0] ? 'answered' : 'interrupted');
      expect(occupantOf(conversationId)).toBeNull();
    }
  });
});
