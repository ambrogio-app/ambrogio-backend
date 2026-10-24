// A separate Node.js process with its own SQLite connection, its own turn repository and its own lookup
// port, driven by a concurrency suite through IPC messages («Garanzie di concorrenza provate da
// esecuzioni concorrenti reali»). Node.js runs this file and the product sources with type stripping;
// the hook below resolves the `.js` specifiers of the sources to their `.ts` files.
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
      const source = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(source))) return nextResolve(source.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { default: Database } = await import('better-sqlite3');
const { Kysely, SqliteDialect } = await import('kysely');
const { ConversationId, TurnId } = await import('../../src/domain/identities.js');
const { Turn } = await import('../../src/domain/turn.js');
const { SqliteTurnRepository } = await import('../../src/adapters/out/sqlite/sqlite-turn-repository.adapter.js');
const { SqliteConversationLookup } = await import('../../src/adapters/out/sqlite/sqlite-conversation-lookup.adapter.js');
type Loaded = ReturnType<typeof Turn.create>;

export type ProcessRequest =
  | Readonly<{ op: 'open'; file: string }>
  | Readonly<{ op: 'exists'; conversationId: string }>
  | Readonly<{ op: 'admit'; conversationId: string; turnId: string; conversation: 'new' | 'existing'; at: number;
    startAt?: number }>
  | Readonly<{ op: 'load'; turnId: string }>
  | Readonly<{ op: 'answer' | 'interrupt'; turnId: string; at: number; startAt?: number }>
  | Readonly<{ op: 'close' }>;

export type ProcessReply = Readonly<{ ok: true; result: unknown }> | Readonly<{ ok: false; fault: string }>;

let db: Readonly<{ destroy(): Promise<void> }> | undefined;
let turns: InstanceType<typeof SqliteTurnRepository> | undefined;
let conversations: InstanceType<typeof SqliteConversationLookup> | undefined;
const loaded = new Map<string, Loaded>();

/** Waits for the instant agreed with the other processes without yielding, so both start together. */
function startAt(instant: number | undefined): void {
  if (instant === undefined) return;
  while (Date.now() < instant) { /* explicit synchronization point */ }
}

async function handle(request: ProcessRequest): Promise<unknown> {
  switch (request.op) {
    case 'open': {
      const sqlite = new Database(request.file);
      sqlite.pragma('foreign_keys = ON');
      const kysely = new Kysely<never>({ dialect: new SqliteDialect({ database: sqlite }) });
      db = kysely;
      turns = new SqliteTurnRepository(kysely as never);
      conversations = new SqliteConversationLookup(kysely as never);
      return process.pid;
    }
    case 'exists':
      return conversations!.exists(ConversationId.create(request.conversationId));
    case 'admit': {
      const turn = Turn.create({ id: TurnId.create(request.turnId), conversationId: ConversationId.create(request.conversationId),
        text: `turn ${request.turnId}`, acceptedAt: new Date(request.at) });
      startAt(request.startAt);
      return turns!.admit({ turn, conversation: request.conversation });
    }
    case 'load': {
      const turn = await turns!.find(TurnId.create(request.turnId));
      if (!turn) throw new Error('turn not found');
      loaded.set(request.turnId, turn);
      return turn.status;
    }
    case 'answer':
    case 'interrupt': {
      const turn = loaded.get(request.turnId)!;
      const transition = request.op === 'answer'
        ? turn.answer(`answer from ${process.pid}`, new Date(request.at))
        : turn.interrupt(new Date(request.at));
      if (!transition.ok) return transition;
      startAt(request.startAt);
      return turns!.saveConclusion(turn);
    }
    case 'close':
      await db?.destroy();
      return 'closed';
  }
}

process.on('message', (request: ProcessRequest) => {
  const done = () => { if (request.op === 'close') process.disconnect(); };
  handle(request).then(
    result => process.send!({ ok: true, result } satisfies ProcessReply, done),
    (error: unknown) => process.send!({ ok: false, fault: error instanceof Error ? error.message : String(error) } satisfies ProcessReply, done),
  );
});
process.send!({ ok: true, result: 'ready' } satisfies ProcessReply);
