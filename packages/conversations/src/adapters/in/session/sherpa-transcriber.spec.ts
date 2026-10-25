// Verification: Prova della trascrizione con Whisper
import { describe, expect, it } from 'vitest';
import { floatSamples, SherpaTranscriber, WHISPER_WINDOW_SAMPLES, type SherpaAsrConfig, type SherpaAsrEngine,
  type SherpaOfflineStream } from './sherpa-transcriber.js';

const model: Parameters<typeof SherpaTranscriber.load>[0] = { engine: 'whisper', language: 'it',
  files: { encoder: '/models/whisper/base-encoder.int8.onnx', decoder: '/models/whisper/base-decoder.int8.onnx',
    tokens: '/models/whisper/base-tokens.txt' } };

/** A recognizer that records its configuration and every decoded window, answering with its length. */
function engine(options: { delayMs?: number; fail?: boolean; texts?: string[] } = {}) {
  const configs: SherpaAsrConfig[] = [];
  const windows: number[] = [];
  const order: string[] = [];
  let active = 0;
  let overlapped = false;
  const asr: SherpaAsrEngine = {
    async createAsync(config) {
      configs.push(config);
      return {
        createStream() {
          const stream: SherpaOfflineStream & { samples?: Float32Array } = {
            acceptWaveform: ({ samples, sampleRate }) => { expect(sampleRate).toBe(16_000); stream.samples = samples; },
          };
          return stream;
        },
        async decodeAsync(stream) {
          const samples = (stream as { samples?: Float32Array }).samples!;
          active++;
          if (active > 1) overlapped = true;
          order.push(`start ${samples.length}`);
          await new Promise(resolve => setTimeout(resolve, options.delayMs ?? 0));
          active--;
          order.push(`end ${samples.length}`);
          windows.push(samples.length);
          if (options.fail) throw new Error('decoding failed');
          return { text: options.texts?.shift() ?? ` window ${samples.length} ` };
        },
      };
    },
  };
  return { asr, configs, windows, order, overlapped: () => overlapped };
}

/** PCM16 audio of `seconds`, delivered in frames of the given sizes in bytes, repeated. */
async function* audio(seconds: number, frameBytes: readonly number[] = [3_200]): AsyncIterable<Uint8Array> {
  const bytes = new Uint8Array(seconds * 16_000 * 2);
  for (let at = 0, index = 0; at < bytes.length; index++) {
    const size = frameBytes[index % frameBytes.length]!;
    yield bytes.subarray(at, at + size);
    at += size;
  }
}

describe('Whisper transcription with sherpa-onnx', () => {
  it('loads one recognizer with the files, the language of the profile and the transcribe task', async () => {
    const { asr, configs } = engine();
    await SherpaTranscriber.load(model, asr);
    expect(configs).toHaveLength(1);
    expect(configs[0]!.featConfig).toEqual({ sampleRate: 16_000, featureDim: 80 });
    expect(configs[0]!.modelConfig).toMatchObject({ whisper: { encoder: model.files.encoder, decoder: model.files.decoder,
      language: 'it', task: 'transcribe' }, tokens: model.files.tokens, provider: 'cpu' });
    expect(configs[0]!.modelConfig.numThreads).toBeGreaterThanOrEqual(1);
    expect(configs[0]!.modelConfig.numThreads).toBeLessThanOrEqual(2);
  });

  it('turns a loading error into a project error', async () => {
    const failing: SherpaAsrEngine = { createAsync: async () => { throw new Error('Please check your config!'); } };
    await expect(SherpaTranscriber.load(model, failing)).rejects.toThrow('Transcription model could not be loaded');
  });

  it.each([[5, [80_000]], [30, [480_000]], [45, [480_000, 240_000]], [60, [480_000, 480_000]]] as const)(
    'decodes %s seconds in windows of at most 30 seconds, in order', async (seconds, expected) => {
      const { asr, windows } = engine();
      const transcriber = await SherpaTranscriber.load(model, asr);
      const text = await transcriber.transcribe(audio(seconds, [3_200, 1_001, 999, 640]));
      expect(windows).toEqual(expected);
      expect(windows.every(length => length <= WHISPER_WINDOW_SAMPLES)).toBe(true);
      expect(text).toBe(expected.map(length => `window ${length}`).join(' '));
    });

  it('joins only the non-empty texts of the windows', async () => {
    const { asr } = engine({ texts: ['  ', ' Seconda parte. '] });
    const transcriber = await SherpaTranscriber.load(model, asr);
    expect(await transcriber.transcribe(audio(45))).toBe('Seconda parte.');
  });

  it('runs the decodings of concurrent requests one at a time', async () => {
    const recorded = engine({ delayMs: 20 });
    const transcriber = await SherpaTranscriber.load(model, recorded.asr);
    const [first, second] = await Promise.all([transcriber.transcribe(audio(2)), transcriber.transcribe(audio(3))]);
    expect(first).toBe('window 32000');
    expect(second).toBe('window 48000');
    expect(recorded.overlapped()).toBe(false);
  });

  it('decodes nothing for an interrupted request and keeps serving the next ones', async () => {
    const recorded = engine();
    const transcriber = await SherpaTranscriber.load(model, recorded.asr);
    async function* interrupted(): AsyncIterable<Uint8Array> {
      yield new Uint8Array(3_200);
      throw new Error('Request interrupted');
    }
    await expect(transcriber.transcribe(interrupted())).rejects.toThrow('Request interrupted');
    expect(recorded.windows).toEqual([]);
    expect(await transcriber.transcribe(audio(1))).toBe('window 16000');
  });

  it('reports a decoding error and decodes nothing after close', async () => {
    const failing = await SherpaTranscriber.load(model, engine({ fail: true }).asr);
    await expect(failing.transcribe(audio(1))).rejects.toThrow('decoding failed');
    const recorded = engine();
    const closed = await SherpaTranscriber.load(model, recorded.asr);
    closed.close();
    await expect(closed.transcribe(audio(1))).rejects.toThrow('Transcription stopped');
    expect(recorded.windows).toEqual([]);
  });

  it('converts PCM16 little-endian samples, ignoring a trailing odd byte', () => {
    const samples = floatSamples([Uint8Array.of(0x00, 0x80, 0xff), Uint8Array.of(0x7f, 0x00)], 5);
    expect([...samples]).toEqual([-1, 0x7fff / 0x8000]);
  });
});
