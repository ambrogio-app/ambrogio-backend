import WebSocket from 'ws';
import { isServerMessage } from './protocol-schema.js';

export type Json = Readonly<Record<string, unknown>> & Readonly<{ type: string }>;
export type Received = Readonly<{ kind: 'json'; message: Json }>
  | Readonly<{ kind: 'binary'; stream: number; data: Buffer }>;

export type Output = { start: Json; text: string; audio: Buffer; ended: boolean };
export type TurnResult = Readonly<{
  accepted?: Json;
  outputs: readonly Output[];
  final: Json;
  /** Message types of this request in arrival order, binary frames as `binary`. */
  sequence: readonly string[];
}>;

export type OpenOptions = Readonly<{ protocols?: readonly string[]; origin?: string; autoPong?: boolean }>;

const openClients = new Set<ProtocolClient>();

/** Every server JSON message received by any test client must match the published schema. */
export function takeSchemaViolations(): unknown[] {
  const violations = [...openClients].flatMap(client => client.violations.splice(0));
  for (const client of openClients) if (client.isClosed) openClients.delete(client);
  return violations;
}

export async function closeAllClients(): Promise<void> {
  await Promise.all([...openClients].map(client => client.close()));
}

export function pcm(text: string, bytes?: number): Buffer {
  const encoded = Buffer.from(text, 'utf8');
  const size = bytes ?? encoded.length + (encoded.length % 2);
  return Buffer.concat([encoded, Buffer.alloc(Math.max(0, size - encoded.length), 0x20)]);
}

function frame(stream: number, data: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(stream);
  return Buffer.concat([header, data]);
}

export async function rejectedUpgradeStatus(url: string, options: OpenOptions = {}): Promise<number> {
  const ws = new WebSocket(url, [...(options.protocols ?? ['ambrogio.v1'])],
    options.origin ? { origin: options.origin } : {});
  return new Promise<number>((resolve, reject) => {
    ws.once('unexpected-response', (_request, response) => { resolve(response.statusCode ?? 0); ws.terminate(); });
    ws.once('open', () => { ws.close(); reject(new Error('Upgrade unexpectedly accepted')); });
    ws.once('error', () => resolve(-1));
  });
}

export class ProtocolClient {
  readonly received: Received[] = [];
  readonly violations: unknown[] = [];
  private readonly listeners = new Set<() => void>();
  private nextStream = 1;
  private nextRequest = 1;
  readonly closed: Promise<Readonly<{ code: number; reason: string }>>;
  isClosed = false;

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data, isBinary) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.concat(data as Buffer[]);
      if (isBinary) {
        this.received.push({ kind: 'binary', stream: buffer.readUInt32BE(0), data: buffer.subarray(4) });
      } else {
        const message = JSON.parse(buffer.toString('utf8')) as Json;
        if (!isServerMessage(message)) this.violations.push(message);
        this.received.push({ kind: 'json', message });
      }
      for (const listener of [...this.listeners]) listener();
    });
    this.closed = new Promise(resolve => ws.once('close', (code, reason) => {
      this.isClosed = true;
      for (const listener of [...this.listeners]) listener();
      resolve({ code, reason: reason.toString() });
    }));
  }

  static async open(url: string, options: OpenOptions = {}): Promise<ProtocolClient> {
    const ws = new WebSocket(url, [...(options.protocols ?? ['ambrogio.v1'])], {
      ...(options.origin ? { origin: options.origin } : {}),
      autoPong: options.autoPong ?? true,
    });
    const client = new ProtocolClient(ws);
    openClients.add(client);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('unexpected-response', (_request, response) =>
        reject(new Error(`Upgrade rejected with ${response.statusCode}`)));
      ws.once('error', reject);
    });
    return client;
  }

  static async ready(url: string, options: OpenOptions & Readonly<{ clientId?: string; name?: string }> = {}) {
    const client = await ProtocolClient.open(url, options);
    await client.hello(options.clientId, options.name);
    return client;
  }

  get protocol(): string { return this.ws.protocol; }

  json(): Json[] {
    return this.received.flatMap(item => item.kind === 'json' ? [item.message] : []);
  }

  errors(): Json[] { return this.json().filter(message => message.type === 'session.error'); }

  send(message: object): void { this.ws.send(JSON.stringify(message)); }
  sendRaw(data: string | Buffer): void { this.ws.send(data); }
  sendFrame(stream: number, data: Buffer): void { this.ws.send(frame(stream, data)); }

  async hello(clientId = 'test-client', name = 'Prova'): Promise<Json> {
    this.send({ type: 'session.hello', clientId, name });
    return this.waitFor(message => message.type === 'session.ready');
  }

  requestId(): string { return `req-${this.nextRequest++}`; }

  startText(requestId: string, options: Readonly<{ conversationId?: string; reply?: 'text' | 'audio' }> = {}) {
    const stream = this.nextStream++;
    this.send({ type: 'input.start', requestId, stream, content: { type: 'text' },
      reply: options.reply ?? 'text', ...(options.conversationId ? { conversationId: options.conversationId } : {}) });
    return stream;
  }

  startAudio(requestId: string, options: Readonly<{ conversationId?: string; reply?: 'text' | 'audio' }> = {}) {
    const stream = this.nextStream++;
    this.send({ type: 'input.start', requestId, stream, content: { type: 'audio', sampleRate: 16000 },
      reply: options.reply ?? 'audio', ...(options.conversationId ? { conversationId: options.conversationId } : {}) });
    return stream;
  }

  chunk(requestId: string, text: string): void { this.send({ type: 'input.chunk', requestId, text }); }
  end(requestId: string): void { this.send({ type: 'input.end', requestId }); }

  sendAudio(stream: number, audio: Buffer, frameBytes = 3200): void {
    for (let offset = 0; offset < audio.length; offset += frameBytes) {
      this.sendFrame(stream, audio.subarray(offset, offset + frameBytes));
    }
  }

  async textTurn(text: string, options: Readonly<{ conversationId?: string; reply?: 'text' | 'audio';
    requestId?: string }> = {}): Promise<TurnResult> {
    const requestId = options.requestId ?? this.requestId();
    this.startText(requestId, options);
    this.chunk(requestId, text);
    this.end(requestId);
    return this.result(requestId);
  }

  async audioTurn(audio: Buffer, options: Readonly<{ conversationId?: string; reply?: 'text' | 'audio';
    requestId?: string }> = {}): Promise<TurnResult> {
    const requestId = options.requestId ?? this.requestId();
    const stream = this.startAudio(requestId, options);
    this.sendAudio(stream, audio);
    this.end(requestId);
    return this.result(requestId);
  }

  /** Waits for a JSON message satisfying the predicate, including messages already received. */
  async waitFor(predicate: (message: Json) => boolean, timeoutMs = 3000): Promise<Json> {
    const found = () => this.json().find(predicate);
    return this.until(found, timeoutMs, 'expected protocol message');
  }

  async until<T>(probe: () => T | undefined, timeoutMs = 3000, label = 'expected condition'): Promise<T> {
    const immediate = probe();
    if (immediate !== undefined) return immediate;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.listeners.delete(check); reject(new Error(`Timed out waiting for ${label}`)); },
        timeoutMs);
      const check = () => {
        const value = probe();
        if (value === undefined) return;
        clearTimeout(timer);
        this.listeners.delete(check);
        resolve(value);
      };
      this.listeners.add(check);
    });
  }

  /** Collects accepted message, transmissions and the single final outcome of one request. */
  view(requestId: string): TurnResult | undefined {
    let accepted: Json | undefined;
    let final: Json | undefined;
    const streams = new Map<number, Output>();
    const outputs: Output[] = [];
    const sequence: string[] = [];
    for (const item of this.received) {
      if (item.kind === 'binary') {
        const output = streams.get(item.stream);
        if (!output) continue;
        output.audio = Buffer.concat([output.audio, item.data]);
        sequence.push('binary');
        continue;
      }
      const message = item.message;
      if (message.type === 'turn.accepted' && message.requestId === requestId) {
        accepted = message; sequence.push(message.type);
      } else if (message.type === 'output.start' && message.requestId === requestId) {
        const output = { start: message, text: '', audio: Buffer.alloc(0), ended: false };
        streams.set(message.stream as number, output);
        outputs.push(output); sequence.push(message.type);
      } else if (message.type === 'output.chunk' && streams.has(message.stream as number)) {
        streams.get(message.stream as number)!.text += message.text as string; sequence.push(message.type);
      } else if (message.type === 'output.end' && streams.has(message.stream as number)) {
        const output = streams.get(message.stream as number)!;
        output.ended = true;
        streams.delete(message.stream as number);
        sequence.push(message.type);
      } else if ((message.type === 'turn.rejected' && message.requestId === requestId)
        || (accepted && ['turn.completed', 'turn.failed', 'turn.interrupted'].includes(message.type)
          && message.turnId === accepted.turnId)) {
        final = message; sequence.push(message.type);
      }
    }
    return final ? { ...(accepted ? { accepted } : {}), outputs, final, sequence } : undefined;
  }

  async result(requestId: string, timeoutMs = 3000): Promise<TurnResult> {
    return this.until(() => this.view(requestId), timeoutMs, `outcome of ${requestId}`);
  }

  async close(): Promise<void> {
    if (!this.isClosed) this.ws.close();
    await this.closed;
    openClients.delete(this);
  }

  terminate(): void { this.ws.terminate(); }
}
