import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { ProjectError } from '../../../application/project-error.js';
import type { TranscriptionModel } from '../../out/voice-config.js';
import type { Transcriber } from './speech-components.js';

const SAMPLE_RATE = 16_000;
/** Whisper in sherpa-onnx decodes at most 30 seconds at a time and drops the rest. */
export const WHISPER_WINDOW_SAMPLES = 30 * SAMPLE_RATE;

/** The `sherpa-onnx-node` configuration of a Whisper recognizer. */
export type SherpaAsrConfig = Readonly<{
  featConfig: Readonly<{ sampleRate: number; featureDim: number }>;
  modelConfig: Readonly<{
    whisper: Readonly<{ encoder: string; decoder: string; language: string; task: 'transcribe' }>;
    tokens: string;
    numThreads: number;
    debug: boolean;
    provider: 'cpu';
  }>;
}>;

export type SherpaOfflineStream = Readonly<{
  acceptWaveform(waveform: Readonly<{ samples: Float32Array; sampleRate: number }>): void;
}>;

/** The part of `OfflineRecognizer` used here: only the asynchronous decoding, never the blocking one. */
export type SherpaRecognizer = Readonly<{
  createStream(): SherpaOfflineStream;
  decodeAsync(stream: SherpaOfflineStream): Promise<Readonly<{ text?: string }>>;
}>;

export type SherpaAsrEngine = Readonly<{ createAsync(config: SherpaAsrConfig): Promise<SherpaRecognizer> }>;

function nativeEngine(): SherpaAsrEngine {
  // The package is CommonJS without type declarations; only the members above are used.
  const sherpa = createRequire(import.meta.url)('sherpa-onnx-node') as { OfflineRecognizer: SherpaAsrEngine };
  return sherpa.OfflineRecognizer;
}

export function whisperConfig(model: TranscriptionModel): SherpaAsrConfig {
  return {
    featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      whisper: { encoder: model.files.encoder, decoder: model.files.decoder, language: model.language, task: 'transcribe' },
      tokens: model.files.tokens,
      numThreads: Math.min(2, availableParallelism()),
      debug: false,
      provider: 'cpu',
    },
  };
}

/** PCM16 little-endian mono as float samples in [-1, 1]; a trailing odd byte is not a sample. */
export function floatSamples(chunks: readonly Uint8Array[], bytes: number): Float32Array {
  const samples = new Float32Array(Math.floor(bytes / 2));
  let index = 0;
  let carry: number | undefined;
  for (const chunk of chunks) {
    for (const byte of chunk) {
      if (carry === undefined) { carry = byte; continue; }
      const value = (byte << 8) | carry;
      samples[index++] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000;
      carry = undefined;
    }
  }
  return samples;
}

/**
 * Whisper recognizes a whole request: the frames are kept in memory while the request is open and decoded at its
 * end, in windows of at most 30 seconds. Decodings run one at a time on the single recognizer.
 */
export class SherpaTranscriber implements Transcriber {
  private recognizer?: SherpaRecognizer;
  private previous: Promise<unknown> = Promise.resolve();

  private constructor(recognizer: SherpaRecognizer) { this.recognizer = recognizer; }

  static async load(model: TranscriptionModel, engine?: SherpaAsrEngine): Promise<SherpaTranscriber> {
    try { return new SherpaTranscriber(await (engine ?? nativeEngine()).createAsync(whisperConfig(model))); }
    catch (error) { throw new ProjectError('Transcription model could not be loaded', { cause: error }); }
  }

  /** An interrupted request makes `audio` throw: nothing is decoded. */
  async transcribe(audio: AsyncIterable<Uint8Array>): Promise<string> {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for await (const chunk of audio) {
      chunks.push(Uint8Array.from(chunk));
      bytes += chunk.byteLength;
    }
    const samples = floatSamples(chunks, bytes);
    const decoding = this.previous.then(() => this.decode(samples));
    this.previous = decoding.catch(() => undefined);
    return decoding;
  }

  close(): void { this.recognizer = undefined; }

  private async decode(samples: Float32Array): Promise<string> {
    const texts: string[] = [];
    for (let start = 0; start < samples.length; start += WHISPER_WINDOW_SAMPLES) {
      const recognizer = this.recognizer;
      if (!recognizer) throw new ProjectError('Transcription stopped');
      const stream = recognizer.createStream();
      stream.acceptWaveform({ samples: samples.subarray(start, start + WHISPER_WINDOW_SAMPLES), sampleRate: SAMPLE_RATE });
      const text = (await recognizer.decodeAsync(stream)).text?.trim();
      if (text) texts.push(text);
    }
    return texts.join(' ');
  }
}
