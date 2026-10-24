import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { ProjectError } from '../../../application/project-error.js';
import { createExchangeTurn, type ExchangeTurn } from '../../../application/exchange-turn.use-case.js';
import type { ConversationHistory } from '../../../application/conversation-history-read.port.js';

type HistoryTurn = ConversationHistory['turns'][number];

/** The pending turn the fake archive returns, as the Application history port describes it. */
const pendingTurn = (text: string): HistoryTurn => ({ id: 'turn-1', text, acceptedAt: new Date(0), status: 'pending' });

// A deadline that never elapses in these session tests.
const deadlines = { start: () => ({ elapsed: new Promise<void>(() => { /* never */ }), cancel() {} }) };
import type { ReplyPart } from '../../../application/produce-conversation-reply.port.js';
import { createConversationSessions,
  type ConversationSessionsDependencies } from './conversation-session.adapter.js';
import { createProtocolDecoder } from './protocol-decoder.js';
import type { SpeechComponents } from './speech-components.js';
import { recordingLogger } from '../../../../test/support/recording-logger.js';

const schemaPath = fileURLToPath(new URL('../../../../../../protocol/ambrogio-v1.schema.json', import.meta.url));
const decode = createProtocolDecoder(JSON.parse(readFileSync(schemaPath, 'utf8')));
const failure = "I can't complete the response.";

/** The subset of a `ws` socket used by the adapter, with controllable delivery failures. */
class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  readonly sent: Array<Record<string, unknown>> = [];
  failDelivery?: (message: Record<string, unknown>) => Error | undefined;

  send(data: string | Buffer, callback: (error?: Error) => void): void {
    const message = typeof data === 'string' ? JSON.parse(data) as Record<string, unknown>
      : { type: 'binary', stream: data.readUInt32BE(0) };
    const error = this.failDelivery?.(message);
    if (!error) this.sent.push(message);
    queueMicrotask(() => callback(error));
  }

  ping(): void {}
  terminate(): void { this.close(); }
  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close');
  }

  client(message: Record<string, unknown>): void {
    this.emit('message', Buffer.from(JSON.stringify(message)), false);
  }

  raw(frame: string): void { this.emit('message', Buffer.from(frame), false); }

  async final(requestId: string): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const turnId = this.sent.find(message => message.type === 'turn.accepted'
        && message.requestId === requestId)?.turnId;
      const found = this.sent.find(message => (message.type === 'turn.rejected' && message.requestId === requestId)
        || (turnId !== undefined && ['turn.completed', 'turn.failed'].includes(message.type as string)
          && message.turnId === turnId));
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error(`No outcome for ${requestId}`);
  }
}

let nextRequest = 0;
function textTurn(socket: FakeSocket, text: string, conversationId?: string): string {
  const requestId = `r${++nextRequest}`;
  socket.client({ type: 'input.start', requestId, stream: nextRequest, content: { type: 'text' }, reply: 'text',
    ...(conversationId === undefined ? {} : { conversationId }) });
  socket.client({ type: 'input.chunk', requestId, text });
  socket.client({ type: 'input.end', requestId });
  return requestId;
}

function harness(exchange: ExchangeTurn, speech?: SpeechComponents) {
  const { log, errors: logs } = recordingLogger();
  const dependencies: ConversationSessionsDependencies = { exchange, decode, language: 'en',
    pingIntervalMs: 60_000, log,
    ...(speech ? { speech } : {}) };
  const sessions = createConversationSessions(dependencies);
  const open = () => {
    const socket = new FakeSocket();
    sessions.attach(socket as unknown as WebSocket);
    socket.client({ type: 'session.hello', clientId: 'test', name: 'Test' });
    return socket;
  };
  return { logs, sessions, open };
}

/** The real exchange use case over an in-memory archive that records stored outcomes. */
function recordingExchange(parts: readonly ReplyPart[]) {
  const outcomes: unknown[] = [];
  let pending: HistoryTurn | undefined;
  const exchange = createExchangeTurn({ deadlines,
    begin: async ({ text }) => {
      pending = pendingTurn(text);
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1', acceptedAt: new Date(0) } };
    },
    history: { async find(id) {
      return { id, createdAt: new Date(0), lastActivityAt: new Date(0), turns: [pending!] };
    } },
    complete: async ({ turnId, outcome }) => {
      outcomes.push(outcome);
      return { ok: true, value: { turnId, status: outcome.kind === 'answer' ? 'answered' : 'failed' } };
    },
    reply: { async *produce() { yield* parts; } },
    failureMessage: failure,
  });
  return { exchange, outcomes };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 20));

describe('conversation session diagnostics', () => {
  // Verification: Prova della diagnostica del guasto di consegna
  // Verification: Prova della continuità dopo un guasto di consegna
  it('logs one technical delivery failure without changing the stored outcome', async () => {
    const { exchange, outcomes } = recordingExchange([{ kind: 'text', text: 'prima ' },
      { kind: 'text', text: 'seconda' }, { kind: 'reply_expectation', expectsReply: false }]);
    const { logs, open } = harness(exchange);
    const socket = open();
    const technical = new Error('TECH_DELIVERY_MARKER');
    socket.failDelivery = message => message.type === 'output.chunk' && message.text === 'prima '
      ? technical : undefined;
    const requestId = textTurn(socket, 'domanda');
    expect(await socket.final(requestId)).toMatchObject({ type: 'turn.completed', expectsReply: false });
    await tick();
    expect(outcomes).toEqual([{ kind: 'answer', text: 'prima seconda' }]);
    expect(logs).toEqual([[{ event: 'conversation_session_delivery_failed', err: technical },
      'Conversation session delivery failed']]);
    expect(JSON.stringify(socket.sent)).not.toContain('TECH_DELIVERY_MARKER');
  });

  // Verification: Prova della diagnostica del guasto di consegna
  it('does not log a normal disconnection during an admitted turn', async () => {
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const outcomes: unknown[] = [];
    const exchange: ExchangeTurn = async (_input, observer) => {
      await observer?.admitted?.('conversation-1', 'turn-1');
      await waiting;
      await observer?.delta?.('tardi');
      outcomes.push('answered');
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1', outcome: 'answered',
        expectsReply: false } };
    };
    const { logs, open } = harness(exchange);
    const socket = open();
    textTurn(socket, 'domanda');
    await tick();
    socket.close();
    release();
    await tick();
    expect(outcomes).toEqual(['answered']);

    // Write errors reported before the close event: a reset code, or any error followed by the close.
    const reset = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    for (const [failure, closes] of [[reset, false], [new Error('socket hang up'), true]] as const) {
      const closing = open();
      closing.failDelivery = () => {
        // The close event follows the failed write callback.
        if (closes) queueMicrotask(() => queueMicrotask(() => closing.close()));
        return failure;
      };
      closing.raw('{not json');
      await tick();
    }
    expect(logs).toEqual([]);
  });

  // Verification: Prova della normalizzazione diagnostica al confine
  // Verification: Prova del campo err nel log definitivo
  // Verification: Prova della separazione tra messaggio pubblico e diagnosi
  // Verification: Prova dell'unicità del log diagnostico definitivo
  it('logs each admission failure once with the original or a fixed normalized error', async () => {
    const cause = new Error('TECH_CAUSE_MARKER');
    const original = new Error('TECH_MESSAGE_MARKER', { cause });
    const project = new ProjectError('PROJECT_MESSAGE_MARKER', { cause });
    const unknown = { secret: 'TECH_OBJECT_MARKER' };
    const thrown: unknown[] = [original, project, unknown, 'TECH_STRING_MARKER'];
    let next = 0;
    const exchange: ExchangeTurn = async () => { throw thrown[next++]; };
    const { logs, open } = harness(exchange);
    const socket = open();
    for (let index = 0; index < thrown.length; index += 1) {
      const outcome = await socket.final(textTurn(socket, 'domanda'));
      expect(outcome).toMatchObject({ type: 'turn.rejected', reason: 'failure', message: failure });
    }
    await tick();
    expect(logs).toHaveLength(thrown.length);
    for (const [details, message] of logs) {
      expect(Object.keys(details as object).sort()).toEqual(['err', 'event']);
      expect(details).toMatchObject({ event: 'conversation_turn_admission_failed' });
      expect(message).toBe('Conversation turn admission failed');
    }
    const errors = logs.map(([details]) => (details as { err: Error }).err);
    expect(errors[0]).toBe(original);
    expect(original.cause).toBe(cause);
    expect(errors[1]).toBe(project);
    expect(errors[2]).toBeInstanceOf(Error);
    expect(errors[2]!.cause).toBe(unknown);
    expect(errors[3]!.cause).toBe('TECH_STRING_MARKER');
    expect(errors[2]!.message).toBe(errors[3]!.message);
    expect(unknown).toEqual({ secret: 'TECH_OBJECT_MARKER' });
    expect(JSON.stringify(socket.sent)).not.toMatch(/TECH_|PROJECT_MESSAGE_MARKER/);
  });

  // Verification: Prova dell'unicità del log diagnostico definitivo
  it('logs a completion failure after admission once and then refuses admissions', async () => {
    const technical = new Error('TECH_COMMIT_MARKER');
    let calls = 0;
    const exchange: ExchangeTurn = async (_input, observer) => {
      calls += 1;
      await observer?.admitted?.('conversation-1', 'turn-1');
      await observer?.delta?.('risposta');
      await observer?.produced?.();
      throw technical;
    };
    const { logs, open } = harness(exchange);
    const socket = open();
    expect(await socket.final(textTurn(socket, 'domanda')))
      .toEqual({ type: 'turn.failed', turnId: 'turn-1', message: failure });
    expect(await socket.final(textTurn(socket, 'ancora')))
      .toMatchObject({ type: 'turn.rejected', reason: 'unavailable' });
    await tick();
    expect(calls).toBe(1);
    expect(logs).toEqual([[{ event: 'conversation_turn_completion_failed', err: technical },
      'Conversation turn completion failed']]);
    expect(JSON.stringify(socket.sent)).not.toContain('TECH_COMMIT_MARKER');
  });

  // Verification: Prova della diagnostica del guasto nella risposta
  it.each<[string, ReplyPart[]]>([
    ['a thrown provider error', []],
    ['a missing reply expectation', [{ kind: 'text', text: 'parziale' }]],
  ])('logs %s once as conversation_reply_failed without exposing it', async (label, parts) => {
    const marker = new Error('TECH_REPLY_MARKER');
    const failingParts = label === 'a thrown provider error'
      ? { async *[Symbol.asyncIterator]() { yield { kind: 'text', text: 'parziale' } as ReplyPart; throw marker; } }
      : (async function* () { yield* parts; })();
    const outcomes: unknown[] = [];
    let pending: HistoryTurn | undefined;
    const exchange = createExchangeTurn({ deadlines,
      begin: async ({ text }) => {
        pending = pendingTurn(text);
        return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1', acceptedAt: new Date(0) } };
      },
      history: { async find(id) {
        return { id, createdAt: new Date(0), lastActivityAt: new Date(0), turns: [pending!] };
      } },
      complete: async ({ turnId, outcome }) => {
        outcomes.push(outcome);
        return { ok: true, value: { turnId, status: outcome.kind === 'answer' ? 'answered' : 'failed' } };
      },
      reply: { produce: () => failingParts as AsyncIterable<ReplyPart> },
      failureMessage: failure,
    });
    const { logs, open } = harness(exchange);
    const socket = open();
    expect(await socket.final(textTurn(socket, 'domanda')))
      .toEqual({ type: 'turn.failed', turnId: 'turn-1', message: failure });
    await tick();
    expect(logs).toHaveLength(1);
    const [details, message] = logs[0]!;
    expect(Object.keys(details as object).sort()).toEqual(['err', 'event']);
    expect(details).toMatchObject({ event: 'conversation_reply_failed' });
    expect(message).toBe('Conversation reply failed');
    const err = (details as { err: Error }).err;
    if (label === 'a thrown provider error') expect(err).toBe(marker);
    else expect(err.message).toBe('Missing reply expectation');
    expect(outcomes).toEqual([{ kind: 'error', message: failure }]);
    expect(JSON.stringify(socket.sent)).not.toContain('TECH_REPLY_MARKER');
  });

  it('logs a history read failure of an admitted turn as conversation_reply_failed', async () => {
    const marker = new Error('TECH_HISTORY_MARKER');
    const exchange = createExchangeTurn({ deadlines,
      begin: async () => ({ ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1', acceptedAt: new Date(0) } }),
      history: { async find() { throw marker; } },
      complete: async ({ turnId }) => ({ ok: true, value: { turnId, status: 'failed' } }),
      reply: { async *produce() { throw new Error('must not run'); } },
      failureMessage: failure,
    });
    const { logs, open } = harness(exchange);
    const socket = open();
    expect(await socket.final(textTurn(socket, 'domanda'))).toMatchObject({ type: 'turn.failed' });
    await tick();
    expect(logs).toEqual([[{ event: 'conversation_reply_failed', err: marker }, 'Conversation reply failed']]);
    expect(JSON.stringify(socket.sent)).not.toContain('TECH_HISTORY_MARKER');
  });

  // Verification: Prova dell'assenza di log automatici per esiti previsti
  it('does not log expected rejections, protocol errors, transcription failures or failed turns', async () => {
    const rejections = ['occupied', 'conversation_not_found', 'temporarily_unavailable'] as const;
    let call = 0;
    const exchange: ExchangeTurn = async (_input, observer) => {
      const kind = rejections[call++];
      if (kind) return { ok: false, error: { kind } };
      await observer?.admitted?.('conversation-1', 'turn-1');
      return { ok: true, value: { conversationId: 'conversation-1', turnId: 'turn-1', outcome: 'failed',
        error: failure } };
    };
    const speech: SpeechComponents = {
      transcriber: { async transcribe() { throw new Error('TECH_STT_MARKER'); } },
      synthesizer: { sampleRate: 22_050, async *synthesize() {} },
      async close() {},
    };
    const { logs, open } = harness(exchange, speech);
    const socket = open();
    for (const reason of ['occupied', 'conversation_not_found', 'unavailable']) {
      expect(await socket.final(textTurn(socket, 'domanda', 'conversation-1'))).toMatchObject({ reason });
    }
    expect(await socket.final(textTurn(socket, '   '))).toMatchObject({ reason: 'invalid' });
    socket.raw('{not json');
    socket.client({ type: 'telepathy.start' });
    socket.client({ type: 'input.end', requestId: 'ghost' });
    socket.client({ type: 'input.start', requestId: 'voice', stream: 99, content: { type: 'audio', sampleRate: 16000 },
      reply: 'text' });
    const frame = Buffer.alloc(4 + 320);
    frame.writeUInt32BE(99, 0);
    socket.emit('message', frame, true);
    socket.client({ type: 'input.end', requestId: 'voice' });
    expect(await socket.final('voice')).toMatchObject({ reason: 'transcription_failed' });
    expect(await socket.final(textTurn(socket, 'domanda'))).toMatchObject({ type: 'turn.failed' });
    await tick();
    expect(socket.sent.filter(message => message.type === 'session.error').map(message => message.code))
      .toEqual(['invalid_message', 'unknown_type', 'unknown_stream']);
    expect(logs).toEqual([]);
  });
});
