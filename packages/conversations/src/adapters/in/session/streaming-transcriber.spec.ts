// Verification: Prova della trascrizione in streaming
import { describe, expect, it } from 'vitest';
import { StreamingTranscriber, type RecognitionWorker } from './streaming-transcriber.js';

const files = { encoder: '/m/encoder.int8.onnx', decoder: '/m/decoder.int8.onnx', joiner: '/m/joiner.int8.onnx',
  tokens: '/m/tokens.txt' };
type Request = Parameters<RecognitionWorker['post']>[0];
type Reply = Parameters<Parameters<RecognitionWorker['onReply']>[0]>[0];

/** Workers that record every request and answer a finished request with its number of samples. */
function workers(options: { failLoad?: boolean } = {}) {
  const spawned: Array<{ requests: Request[]; terminated: boolean; exit(error: Error): void; reply(r: Reply): void }> = [];
  const spawn = () => {
    let replyListener: (reply: Reply) => void = () => undefined;
    let exitListener: (error: Error) => void = () => undefined;
    const samples = new Map<number, number>();
    const record = { requests: [] as Request[], terminated: false,
      exit: (error: Error) => exitListener(error), reply: (r: Reply) => replyListener(r) };
    spawned.push(record);
    setImmediate(() => replyListener(options.failLoad ? { type: 'failed', message: 'Please check your config!' } : { type: 'ready' }));
    const worker: RecognitionWorker = {
      post(request) {
        record.requests.push(request);
        if (request.type === 'audio') samples.set(request.id, (samples.get(request.id) ?? 0) + request.samples.length);
        if (request.type === 'finish') setImmediate(() => replyListener({ type: 'result', id: request.id, text: `${samples.get(request.id) ?? 0}` }));
      },
      onReply: listener => { replyListener = listener; },
      onExit: listener => { exitListener = listener; },
      async terminate() { record.terminated = true; exitListener(new Error('terminated')); },
    };
    return worker;
  };
  return { spawn, spawned };
}

/** PCM16 audio of `seconds` in frames of the given byte sizes, with a pause after each frame. */
async function* audio(seconds: number, frameBytes: readonly number[] = [3_200], seen?: (index: number) => void) {
  const bytes = new Uint8Array(seconds * 32_000);
  for (let at = 0, index = 0; at < bytes.length; index++) {
    const size = frameBytes[index % frameBytes.length]!;
    yield bytes.subarray(at, at + size);
    at += size;
    seen?.(index);
    await new Promise(resolve => setImmediate(resolve));
  }
}

/** One frame, then waits until `release` is called before ending. */
function held() {
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  async function* frames() { yield new Uint8Array(3_200); await released; }
  return { frames: frames(), release };
}

describe('streaming transcriber', () => {
  it('sends every frame to the worker before the end of the request', async () => {
    const { spawn, spawned } = workers();
    const transcriber = await StreamingTranscriber.load(files, spawn);
    const sentBeforeEnd: number[] = [];
    const text = await transcriber.transcribe(audio(5, [3_200], () => sentBeforeEnd.push(spawned[0]!.requests.length)));
    expect(text).toBe('80000');
    // Each frame reached the worker right after it arrived, before the next one.
    expect(sentBeforeEnd.slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(spawned[0]!.requests.at(-1)).toEqual({ type: 'finish', id: 1 });
  });

  it.each([5, 60])('transcribes %s seconds sent in frames of any size, odd sizes included', async seconds => {
    const { spawn } = workers();
    const transcriber = await StreamingTranscriber.load(files, spawn);
    expect(await transcriber.transcribe(audio(seconds, [3_201, 999, 640]))).toBe(`${seconds * 16_000}`);
  });

  it('keeps concurrent requests apart', async () => {
    const { spawn, spawned } = workers();
    const transcriber = await StreamingTranscriber.load(files, spawn);
    expect(await Promise.all([transcriber.transcribe(audio(2)), transcriber.transcribe(audio(3))])).toEqual(['32000', '48000']);
    expect(new Set(spawned[0]!.requests.map(request => request.id))).toEqual(new Set([1, 2]));
  });

  it('cancels an interrupted request', async () => {
    const { spawn, spawned } = workers();
    const transcriber = await StreamingTranscriber.load(files, spawn);
    async function* interrupted() { yield new Uint8Array(3_200); throw new Error('Request interrupted'); }
    await expect(transcriber.transcribe(interrupted())).rejects.toThrow('Request interrupted');
    expect(spawned[0]!.requests.map(request => request.type)).toEqual(['audio', 'cancel']);
  });

  it('fails a request on a decoding error', async () => {
    const { spawn, spawned } = workers();
    const transcriber = await StreamingTranscriber.load(files, spawn);
    const request = held();
    const running = transcriber.transcribe(request.frames);
    await new Promise(resolve => setTimeout(resolve, 5));
    spawned[0]!.reply({ type: 'error', id: 1, message: 'native failure' });
    request.release();
    await expect(running).rejects.toThrow('native failure');
  });

  it('fails the requests in progress when the worker stops and starts a new worker for the next one', async () => {
    const { spawn, spawned } = workers();
    const transcriber = await StreamingTranscriber.load(files, spawn);
    const request = held();
    const running = transcriber.transcribe(request.frames);
    await new Promise(resolve => setTimeout(resolve, 5));
    spawned[0]!.exit(new Error('worker crashed'));
    request.release();
    await expect(running).rejects.toThrow('worker crashed');
    expect(await transcriber.transcribe(audio(1))).toBe('16000');
    expect(spawned).toHaveLength(2);
  });

  it('refuses to start when the model cannot be loaded', async () => {
    const { spawn, spawned } = workers({ failLoad: true });
    await expect(StreamingTranscriber.load(files, spawn)).rejects.toThrow('Transcription model could not be loaded');
    expect(spawned[0]!.terminated).toBe(true);
  });

  it('terminates the worker at close and transcribes nothing afterwards', async () => {
    const { spawn, spawned } = workers();
    const transcriber = await StreamingTranscriber.load(files, spawn);
    await transcriber.close();
    expect(spawned[0]!.terminated).toBe(true);
    await expect(transcriber.transcribe(audio(1))).rejects.toThrow('Transcription stopped');
  });
});
