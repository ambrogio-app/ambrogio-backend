import type { WebSocket } from 'ws';
import type { BeginTurnRejection } from '../../../application/begin-turn.use-case.js';
import type { ExchangeTurn } from '../../../application/exchange-turn.use-case.js';
import type { DecodedMessage, InputStart } from './protocol-decoder.js';
import type { SpeechComponents } from './speech-components.js';

export const sessionProtocol = 'ambrogio.v1';
export const sessionRoute = '/api/session';
/** 64 KiB of UTF-8 text per turn. */
export const maxTextBytes = 65_536;
/** 60 seconds of PCM16 mono audio at 16 kHz per turn. */
export const maxAudioBytes = 60 * 16_000 * 2;

type Language = 'en' | 'it';
export type RejectionReason = 'invalid' | 'conversation_not_found' | 'occupied' | 'unavailable' | 'too_large'
  | 'transcription_failed' | 'audio_unavailable' | 'failure';
type ErrorCode = 'invalid_message' | 'unknown_type' | 'unknown_stream' | 'session_not_ready' | 'audio_busy';
type ContentType = 'text' | 'audio';
type ServerMessage = Readonly<Record<string, unknown> & { type: string }>;

const rejectionMessages: Record<RejectionReason, Record<Language, string>> = {
  invalid: { en: 'Invalid message.', it: 'Messaggio non valido.' },
  conversation_not_found: { en: 'Conversation not found.', it: 'Conversazione non trovata.' },
  occupied: { en: 'Another turn is in progress.', it: 'Un altro turno è in corso.' },
  unavailable: { en: 'Service temporarily unavailable.', it: 'Servizio temporaneamente non disponibile.' },
  too_large: { en: 'Request too large.', it: 'Richiesta troppo grande.' },
  transcription_failed: { en: "I didn't understand the request.", it: 'Non ho capito la richiesta.' },
  audio_unavailable: { en: 'Voice is not available.', it: 'La voce non è disponibile.' },
  failure: { en: "I can't complete the response.", it: 'Non riesco a completare la risposta.' },
};

const errorMessages: Record<ErrorCode, string> = {
  invalid_message: 'Invalid message.',
  unknown_type: 'Unknown message type.',
  unknown_stream: 'Unknown request or stream.',
  session_not_ready: 'Session not ready.',
  audio_busy: 'Another audio transmission is open.',
};

const admissionRejections: Record<BeginTurnRejection['kind'], RejectionReason> = {
  occupied: 'occupied',
  conversation_not_found: 'conversation_not_found',
  temporarily_unavailable: 'unavailable',
};

export type DiagnosticLog = Readonly<{ error(details: object, message: string): void }>;

export type ConversationSessionsDependencies = Readonly<{
  exchange: ExchangeTurn;
  decode: (frame: string) => DecodedMessage;
  language: Language;
  speech?: SpeechComponents;
  pingIntervalMs: number;
  log: DiagnosticLog;
}>;

export type ConversationSessions = Readonly<{
  /** Serve one accepted `ambrogio.v1` WebSocket; `log` carries the session's diagnostic correlation. */
  attach(socket: WebSocket, log?: DiagnosticLog): void;
  /** Refuse new admissions and wait for admissions already in progress to settle. */
  stopAccepting(): Promise<void>;
  /** Notify interrupted turns, then close every open session. */
  closeSessions(): Promise<void>;
}>;

/** Socket errors that mean the client disconnected, not a technical delivery failure. */
const disconnectionCodes = new Set(['ECONNRESET', 'EPIPE', 'ECONNABORTED', 'ERR_STREAM_DESTROYED',
  'ERR_STREAM_WRITE_AFTER_END']);

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown conversation session failure', { cause: value });
}

/** An ordered source that the producer can end; iteration finishes once ended and drained. */
class Queue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private ended = false;
  private wake?: () => void;

  push(item: T): void {
    if (this.ended) return;
    this.items.push(item);
    this.wake?.();
  }

  end(): void {
    this.ended = true;
    this.wake?.();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for (;;) {
      if (this.items.length) { yield this.items.shift()!; continue; }
      if (this.ended) return;
      await new Promise<void>(resolve => { this.wake = resolve; });
      this.wake = undefined;
    }
  }
}

type OpenRequest = {
  readonly requestId: string;
  readonly stream: number;
  readonly content: ContentType;
  readonly reply: ContentType;
  readonly conversationId?: string;
  readonly text: string[];
  textBytes: number;
  /** Frames go to the transcriber while the request is open; the transcript is used after `input.end`. */
  transcription?: Readonly<{ frames: Queue<Uint8Array>; transcript: Promise<string> }>;
  audioBytes: number;
};

type ActiveTurn = {
  readonly requestId: string;
  readonly reply: ContentType;
  turnId?: string;
  output?: Transmission;
  /** The outcome message was sent, or the turn no longer reports to this session. */
  finished: boolean;
};

class ConversationSession {
  private ready = false;
  private closed = false;
  private readonly requests = new Map<string, OpenRequest>();
  private readonly inputStreams = new Map<number, OpenRequest>();
  /** Rejected requests whose remaining transmission is ignored until `input.end`. */
  private readonly discarded = new Map<string, number>();
  private audioInput?: OpenRequest;
  private nextOutputStream = 1;
  private audioOutput: Promise<void> = Promise.resolve();
  private readonly turns = new Set<ActiveTurn>();
  readonly syntheses = new Set<AbortController>();
  private alive = true;
  private readonly ping: NodeJS.Timeout;

  constructor(readonly socket: WebSocket, readonly owner: SessionRegistry, readonly log: DiagnosticLog) {
    socket.on('message', (data, isBinary) => {
      const frame = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
      if (isBinary) this.receiveFrame(frame);
      else this.receiveMessage(frame.toString('utf8'));
    });
    socket.on('pong', () => { this.alive = true; });
    socket.on('error', () => { /* the close event releases the session */ });
    socket.once('close', () => this.release());
    this.ping = setInterval(() => {
      if (!this.alive) { socket.terminate(); return; }
      this.alive = false;
      socket.ping();
    }, owner.dependencies.pingIntervalMs);
  }

  get isClosed(): boolean { return this.closed; }

  send(message: ServerMessage): void {
    if (this.closed || this.socket.readyState !== this.socket.OPEN) return;
    this.socket.send(JSON.stringify(message), error => this.deliveryFailed(error));
  }

  sendAudio(stream: number, chunk: Uint8Array): void {
    if (this.closed || this.socket.readyState !== this.socket.OPEN) return;
    const frame = Buffer.allocUnsafe(4 + chunk.length);
    frame.writeUInt32BE(stream, 0);
    frame.set(chunk, 4);
    this.socket.send(frame, error => this.deliveryFailed(error));
  }

  private deliveryFailed(error: Error | undefined): void {
    if (!error || disconnectionCodes.has((error as NodeJS.ErrnoException).code ?? '')) return;
    // A write failing because the peer went away may be reported before the close event.
    setImmediate(() => {
      if (this.closed || this.socket.readyState !== this.socket.OPEN) return;
      this.log.error({ event: 'conversation_session_delivery_failed', err: normalizeError(error) },
        'Conversation session delivery failed');
    });
  }

  outputStream(): number {
    const stream = this.nextOutputStream;
    this.nextOutputStream = stream === 0xffff_ffff ? 1 : stream + 1;
    return stream;
  }

  /** Serialize audio transmissions: at most one is open per session. */
  async acquireAudioOutput(): Promise<() => void> {
    let release!: () => void;
    const previous = this.audioOutput;
    this.audioOutput = new Promise<void>(resolve => { release = resolve; });
    await previous;
    return release;
  }

  private error(code: ErrorCode, requestId?: string): void {
    this.send({ type: 'session.error', code, message: errorMessages[code],
      ...(requestId === undefined ? {} : { requestId }) });
  }

  private receiveMessage(frame: string): void {
    const decoded = this.owner.dependencies.decode(frame);
    if (!decoded.ok) { this.error(decoded.code, decoded.requestId); return; }
    const message = decoded.message;
    if (message.type === 'session.hello') {
      if (this.ready) { this.error('invalid_message'); return; }
      this.ready = true;
      this.send({ type: 'session.ready', protocol: sessionProtocol });
      return;
    }
    if (!this.ready) {
      this.error('session_not_ready', 'requestId' in message ? message.requestId : undefined);
      return;
    }
    switch (message.type) {
      case 'input.start': this.open(message); return;
      case 'input.chunk': {
        if (this.discarded.has(message.requestId)) return;
        const request = this.requests.get(message.requestId);
        if (!request) { this.error('unknown_stream', message.requestId); return; }
        if (request.content !== 'text') { this.error('invalid_message', message.requestId); return; }
        request.textBytes += Buffer.byteLength(message.text, 'utf8');
        if (request.textBytes > maxTextBytes) { this.discard(request); return; }
        request.text.push(message.text);
        return;
      }
      case 'input.end': {
        const stream = this.discarded.get(message.requestId);
        if (stream !== undefined) { this.discarded.delete(message.requestId); return; }
        const request = this.requests.get(message.requestId);
        if (!request) { this.error('unknown_stream', message.requestId); return; }
        this.close(request);
        void this.runTurn(request);
        return;
      }
      case 'client.result': return;
    }
  }

  private open(message: InputStart): void {
    const { requestId, stream } = message;
    if (this.requests.has(requestId) || this.discarded.has(requestId)
      || this.inputStreams.has(stream) || [...this.discarded.values()].includes(stream)) {
      this.error('invalid_message', requestId);
      return;
    }
    if (message.content.type === 'audio' && this.audioInput) { this.error('audio_busy', requestId); return; }
    const request: OpenRequest = { requestId, stream, content: message.content.type, reply: message.reply,
      ...(message.conversationId === undefined ? {} : { conversationId: message.conversationId }),
      text: [], textBytes: 0, audioBytes: 0 };
    const speech = this.owner.dependencies.speech;
    if (request.content === 'audio' && speech) {
      const frames = new Queue<Uint8Array>();
      const transcript = speech.transcriber.transcribe(frames);
      // An unusable transcription is decided after `input.end`; a discarded one has no effect.
      transcript.catch(() => undefined);
      request.transcription = { frames, transcript };
    }
    this.requests.set(requestId, request);
    this.inputStreams.set(stream, request);
    if (request.content === 'audio') this.audioInput = request;
  }

  private receiveFrame(frame: Buffer): void {
    if (!this.ready) { this.error('session_not_ready'); return; }
    if (frame.length < 4) { this.error('invalid_message'); return; }
    const stream = frame.readUInt32BE(0);
    if ([...this.discarded.values()].includes(stream)) return;
    const request = this.inputStreams.get(stream);
    if (!request || request.content !== 'audio') { this.error('unknown_stream'); return; }
    request.audioBytes += frame.length - 4;
    if (request.audioBytes > maxAudioBytes) { this.discard(request); return; }
    request.transcription?.frames.push(frame.subarray(4));
  }

  private close(request: OpenRequest): void {
    request.transcription?.frames.end();
    this.requests.delete(request.requestId);
    this.inputStreams.delete(request.stream);
    if (this.audioInput === request) this.audioInput = undefined;
  }

  /** Reject a request beyond the transmission limits without waiting for `input.end`. */
  private discard(request: OpenRequest): void {
    this.close(request);
    request.text.length = 0;
    request.transcription = undefined;
    this.discarded.set(request.requestId, request.stream);
    const turn: ActiveTurn = { requestId: request.requestId, reply: request.reply, finished: false };
    this.turns.add(turn);
    void this.reject(turn, 'too_large').finally(() => this.turns.delete(turn));
  }

  private async runTurn(request: OpenRequest): Promise<void> {
    const { dependencies } = this.owner;
    const turn: ActiveTurn = { requestId: request.requestId, reply: request.reply, finished: false };
    this.turns.add(turn);
    try {
      const speech = dependencies.speech;
      if (!speech && (request.content === 'audio' || request.reply === 'audio')) {
        await this.reject(turn, 'audio_unavailable');
        return;
      }
      let text: string;
      if (request.content === 'text') text = request.text.join('');
      else {
        try { text = await request.transcription!.transcript; }
        catch { text = ''; }
        if (typeof text !== 'string' || !text.trim()) { await this.reject(turn, 'transcription_failed'); return; }
      }
      if (!text.trim()) { await this.reject(turn, 'invalid'); return; }
      if (this.closed) return;
      if (!this.owner.accepting) { await this.reject(turn, 'unavailable'); return; }
      await this.exchange(turn, text, request.conversationId);
    } finally {
      if (turn.finished) this.turns.delete(turn);
    }
  }

  private async exchange(turn: ActiveTurn, text: string, conversationId: string | undefined): Promise<void> {
    const { dependencies } = this.owner;
    let settle!: () => void;
    const admission = new Promise<void>(resolve => { settle = resolve; });
    this.owner.admissions.add(admission);
    void admission.then(() => this.owner.admissions.delete(admission));
    let result: Awaited<ReturnType<ExchangeTurn>>;
    try {
      result = await dependencies.exchange({ text, ...(conversationId === undefined ? {} : { conversationId }) }, {
        admitted: (admittedConversation, turnId) => {
          turn.turnId = turnId;
          settle();
          if (turn.finished) return;
          this.send({ type: 'turn.accepted', requestId: turn.requestId, conversationId: admittedConversation,
            turnId, text });
        },
        delta: delta => {
          if (turn.finished) return;
          turn.output ??= new Transmission(this, turn, turn.reply);
          turn.output.write(delta);
        },
        produced: () => { turn.output?.finish(); },
      }, () => this.owner.stopping);
    } catch (error) {
      settle();
      if (turn.finished) return;
      if (turn.turnId === undefined) {
        this.log.error({ event: 'conversation_turn_admission_failed', err: normalizeError(error) },
          'Conversation turn admission failed');
        await this.reject(turn, 'failure');
        return;
      }
      if (this.owner.stopping) return;
      this.owner.accepting = false;
      this.log.error({ event: 'conversation_turn_completion_failed', err: normalizeError(error) },
        'Conversation turn completion failed');
      await this.fail(turn, this.owner.message('failure'));
      return;
    } finally {
      settle();
    }
    if (turn.finished) return;
    if (!result.ok) { await this.reject(turn, admissionRejections[result.error.kind]); return; }
    switch (result.value.outcome) {
      case 'answered':
        await turn.output?.close();
        if (turn.finished) return;
        turn.finished = true;
        this.send({ type: 'turn.completed', turnId: result.value.turnId, expectsReply: result.value.expectsReply });
        return;
      case 'failed':
        if (result.value.cause !== undefined) {
          this.log.error({ event: 'conversation_reply_failed', err: normalizeError(result.value.cause) },
            'Conversation reply failed');
        }
        await this.fail(turn, result.value.error);
        return;
      case 'interrupted':
        // Shutdown reports the interruption after the archive has stored it.
        return;
    }
  }

  /** Transmit a complete message as one transmission of the requested content type. */
  private async transmit(turn: ActiveTurn, message: string, content: ContentType): Promise<void> {
    const output = new Transmission(this, turn, content);
    turn.output = output;
    output.write(message);
    output.finish();
    await output.close();
  }

  private async reject(turn: ActiveTurn, reason: RejectionReason): Promise<void> {
    const message = this.owner.message(reason);
    await this.transmit(turn, message, reason === 'audio_unavailable' ? 'text' : turn.reply);
    if (turn.finished) return;
    turn.finished = true;
    this.send({ type: 'turn.rejected', requestId: turn.requestId, reason, message });
  }

  private async fail(turn: ActiveTurn, message: string): Promise<void> {
    await turn.output?.close();
    if (turn.finished) return;
    await this.transmit(turn, message, turn.reply);
    if (turn.finished) return;
    turn.finished = true;
    this.send({ type: 'turn.failed', turnId: turn.turnId, message });
  }

  /** Report admitted turns without an outcome as interrupted, then close the session. */
  async shutdown(): Promise<void> {
    const interrupted = [...this.turns].filter(turn => !turn.finished);
    for (const turn of interrupted) turn.finished = true;
    // Abort every transmission first: one may be waiting for the audio output held by another.
    await Promise.all(interrupted.map(turn => turn.output?.interrupt()));
    for (const turn of interrupted) {
      if (turn.turnId !== undefined) this.send({ type: 'turn.interrupted', turnId: turn.turnId });
    }
    if (!this.closed) this.socket.close(1001, 'Server stopping');
    this.release();
  }

  private release(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.ping);
    // Unfinished requests are discarded: their transcription ends without effects.
    for (const request of this.requests.values()) request.transcription?.frames.end();
    this.requests.clear();
    this.inputStreams.clear();
    this.discarded.clear();
    this.audioInput = undefined;
    for (const turn of this.turns) {
      if (turn.turnId === undefined) turn.finished = true;
      turn.output?.abort();
    }
    this.owner.sessions.delete(this);
  }
}

/** One server transmission: `output.start`, text chunks or audio frames, `output.end`. */
class Transmission {
  private readonly queue = new Queue<string>();
  private readonly controller = new AbortController();
  private readonly done: Promise<void>;

  constructor(private readonly session: ConversationSession, turn: ActiveTurn, private readonly content: ContentType) {
    const start = { type: 'output.start', requestId: turn.requestId,
      ...(turn.turnId === undefined ? {} : { turnId: turn.turnId }) };
    this.done = content === 'text' ? this.sendText(start) : this.sendAudio(start);
  }

  write(text: string): void { this.queue.push(text); }

  /** No further content: the transmission ends once what was written has been sent. */
  finish(): void { this.queue.end(); }

  /** Wait until `output.end` has been sent, or the transmission was abandoned. */
  async close(): Promise<void> {
    this.finish();
    await this.done;
  }

  /** Stop producing content now and end the transmission. */
  async interrupt(): Promise<void> {
    this.controller.abort();
    this.finish();
    await this.done;
  }

  /** The session closed: stop synthesis; nothing more is delivered. */
  abort(): void {
    this.controller.abort();
  }

  private async sendText(start: Record<string, unknown>): Promise<void> {
    const stream = this.session.outputStream();
    this.session.send({ ...start, type: 'output.start', stream, content: { type: 'text' } });
    for await (const text of this.queue) {
      if (this.controller.signal.aborted) break;
      this.session.send({ type: 'output.chunk', stream, text });
    }
    this.session.send({ type: 'output.end', stream });
  }

  private async sendAudio(start: Record<string, unknown>): Promise<void> {
    const synthesizer = this.session.owner.dependencies.speech!.synthesizer;
    const release = await this.session.acquireAudioOutput();
    const { signal } = this.controller;
    try {
      if (signal.aborted || this.session.isClosed) return;
      const stream = this.session.outputStream();
      this.session.send({ ...start, type: 'output.start', stream,
        content: { type: 'audio', sampleRate: synthesizer.sampleRate } });
      this.session.syntheses.add(this.controller);
      try {
        for await (const chunk of synthesizer.synthesize(this.queue, signal)) {
          if (signal.aborted) break;
          this.session.sendAudio(stream, chunk);
        }
      } catch (error) {
        if (!signal.aborted) {
          this.session.log.error({ event: 'conversation_speech_synthesis_failed',
            err: normalizeError(error) }, 'Speech synthesis failed');
        }
      } finally {
        this.session.syntheses.delete(this.controller);
      }
      this.session.send({ type: 'output.end', stream });
    } finally {
      release();
    }
  }
}

class SessionRegistry implements ConversationSessions {
  accepting = true;
  stopping = false;
  readonly sessions = new Set<ConversationSession>();
  readonly admissions = new Set<Promise<void>>();

  constructor(readonly dependencies: ConversationSessionsDependencies) {}

  message(reason: RejectionReason): string {
    return rejectionMessages[reason][this.dependencies.language];
  }

  attach(socket: WebSocket, log: DiagnosticLog = this.dependencies.log): void {
    if (this.stopping) { socket.close(1001, 'Server stopping'); return; }
    this.sessions.add(new ConversationSession(socket, this, log));
  }

  async stopAccepting(): Promise<void> {
    this.accepting = false;
    this.stopping = true;
    await Promise.allSettled([...this.admissions]);
  }

  async closeSessions(): Promise<void> {
    await Promise.allSettled([...this.sessions].map(session => session.shutdown()));
  }
}

export function createConversationSessions(dependencies: ConversationSessionsDependencies): ConversationSessions {
  return new SessionRegistry(dependencies);
}
