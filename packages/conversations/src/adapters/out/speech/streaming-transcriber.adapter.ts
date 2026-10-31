import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { ProjectError } from '../../../application/project-error.js';
import type { TranscriptionModelFiles } from '../voice-config.js';
import { onlineRecognizerConfig, type OnlineRecognizerConfig, type RecognitionReply,
  type RecognitionRequest } from './streaming-recognition.js';
import type { Transcriber } from '../../in/session/speech-components.port.js';

/** The recognition worker as seen by the transcriber; replaced in tests. */
export type RecognitionWorker = Readonly<{
  post(request: RecognitionRequest): void;
  onReply(listener: (reply: RecognitionReply) => void): void;
  /** Called once when the worker stops, by a fault or by `terminate`. */
  onExit(listener: (error: Error) => void): void;
  terminate(): Promise<void>;
}>;

export type SpawnRecognitionWorker = (config: OnlineRecognizerConfig) => RecognitionWorker;

function nodeWorker(config: OnlineRecognizerConfig): RecognitionWorker {
  // The worker does not inherit the command-line options of the process, which apply to its entry point only.
  const worker = new Worker(new URL('./streaming-recognizer.worker.js', import.meta.url), { workerData: { config }, execArgv: [] });
  return {
    post(request) {
      // The samples move to the worker without a copy.
      worker.postMessage(request, request.type === 'audio' ? [request.samples.buffer as ArrayBuffer] : []);
    },
    onReply: listener => { worker.on('message', listener); },
    onExit(listener) {
      let reported = false;
      const report = (error: Error) => { if (!reported) { reported = true; listener(error); } };
      worker.on('error', report);
      worker.on('exit', code => report(new Error(`Recognition worker exited with code ${code}`)));
    },
    async terminate() { await worker.terminate(); },
  };
}

type Pending = Readonly<{ resolve(text: string): void; reject(error: unknown): void }>;

/**
 * Transcribes each request while it is open: every frame goes to the recognition worker as soon as it arrives and the
 * text is read at the end. A worker that stops by a fault fails the requests in progress; the next request starts a
 * new one.
 */
export class StreamingTranscriber implements Transcriber {
  private worker?: Promise<RecognitionWorker>;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private closed = false;

  private constructor(private readonly config: OnlineRecognizerConfig, private readonly spawn: SpawnRecognitionWorker) {}

  static async load(files: TranscriptionModelFiles, spawn: SpawnRecognitionWorker = nodeWorker): Promise<StreamingTranscriber> {
    const transcriber = new StreamingTranscriber(onlineRecognizerConfig(files, Math.min(2, availableParallelism())), spawn);
    try { await transcriber.started(); }
    catch (error) { throw new ProjectError('Transcription model could not be loaded', { cause: error }); }
    return transcriber;
  }

  /** An interrupted request makes `audio` throw: its stream is discarded. */
  async transcribe(audio: AsyncIterable<Uint8Array>): Promise<string> {
    if (this.closed) throw new ProjectError('Transcription stopped');
    const worker = await this.started();
    const id = this.nextId++;
    const result = new Promise<string>((resolve, reject) => { this.pending.set(id, { resolve, reject }); });
    result.catch(() => undefined);
    let carry: number | undefined;
    try {
      for await (const chunk of audio) {
        const bytes = carry === undefined ? chunk : Uint8Array.of(carry, ...chunk);
        carry = bytes.length % 2 === 1 ? bytes[bytes.length - 1] : undefined;
        const samples = new Float32Array(Math.floor(bytes.length / 2));
        for (let index = 0; index < samples.length; index++) {
          const value = bytes[index * 2]! | (bytes[index * 2 + 1]! << 8);
          samples[index] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000;
        }
        if (samples.length) worker.post({ type: 'audio', id, samples });
      }
    } catch (error) {
      this.pending.delete(id);
      worker.post({ type: 'cancel', id });
      throw error;
    }
    worker.post({ type: 'finish', id });
    return result;
  }

  async close(): Promise<void> {
    this.closed = true;
    const worker = this.worker;
    this.worker = undefined;
    this.failAll(new ProjectError('Transcription stopped'));
    await (await worker?.catch(() => undefined))?.terminate();
  }

  private started(): Promise<RecognitionWorker> {
    if (this.worker) return this.worker;
    const starting = new Promise<RecognitionWorker>((resolve, reject) => {
      const worker = this.spawn(this.config);
      worker.onReply(reply => {
        if (reply.type === 'ready') resolve(worker);
        else if (reply.type === 'failed') { reject(new Error(reply.message)); void worker.terminate(); }
        else this.settle(reply);
      });
      worker.onExit(error => {
        reject(error);
        if (this.worker === starting) this.worker = undefined;
        this.failAll(error);
      });
    });
    starting.catch(() => { if (this.worker === starting) this.worker = undefined; });
    this.worker = starting;
    return starting;
  }

  private settle(reply: Extract<RecognitionReply, { id: number }>): void {
    const pending = this.pending.get(reply.id);
    if (!pending) return;
    this.pending.delete(reply.id);
    if (reply.type === 'result') pending.resolve(reply.text);
    else pending.reject(new Error(reply.message));
  }

  private failAll(error: unknown): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
