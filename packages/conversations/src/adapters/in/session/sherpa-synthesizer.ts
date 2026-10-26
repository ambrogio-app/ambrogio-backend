import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { ProjectError } from '../../../application/project-error.js';
import { type VoiceModelFiles } from '../../out/voice-config.js';
import { spokenSentence, takeSentences } from './sentences.js';
import type { Synthesizer } from './speech-components.js';

/** The `sherpa-onnx-node` configuration of a Piper (VITS) voice. */
export type SherpaTtsConfig = Readonly<{
  model: Readonly<{
    vits: VoiceModelFiles;
    numThreads: number;
    debug: boolean;
    provider: 'cpu';
  }>;
  maxNumSentences: number;
}>;

/** The part of `OfflineTts` used here: only the asynchronous generation, never the blocking one. */
export type SherpaTts = Readonly<{
  sampleRate: number;
  generateAsync(request: Readonly<{ text: string; sid: number; speed: number }>):
    Promise<Readonly<{ samples: Float32Array; sampleRate: number }>>;
}>;

export type SherpaTtsEngine = Readonly<{ createAsync(config: SherpaTtsConfig): Promise<SherpaTts> }>;

function nativeEngine(): SherpaTtsEngine {
  // The package is CommonJS without type declarations; only the members above are used.
  const sherpa = createRequire(import.meta.url)('sherpa-onnx-node') as { OfflineTts: SherpaTtsEngine };
  return sherpa.OfflineTts;
}

export function sherpaConfig(voice: VoiceModelFiles): SherpaTtsConfig {
  return {
    model: { vits: voice, numThreads: Math.min(4, availableParallelism()), debug: false, provider: 'cpu' },
    maxNumSentences: 1,
  };
}

/** The sherpa-onnx speaker ID: a Piper voice has a single speaker. */
const PIPER_SPEAKER = 0;

/** Float samples in [-1, 1] as PCM16 little-endian. */
export function pcm16(samples: Float32Array): Uint8Array {
  const bytes = Buffer.allocUnsafe(samples.length * 2);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    bytes.writeInt16LE(Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), index * 2);
  }
  return bytes;
}

const stopped = Symbol('stopped');

/**
 * The voice is loaded once; each sentence is generated as soon as it is complete. Generations
 * run one at a time on the single loaded voice, in the order they were requested.
 */
export class SherpaSynthesizer implements Synthesizer {
  readonly sampleRate: number;
  private tts?: SherpaTts;
  private previous: Promise<unknown> = Promise.resolve();

  private constructor(tts: SherpaTts) {
    this.tts = tts;
    this.sampleRate = tts.sampleRate;
  }

  static async load(voice: VoiceModelFiles, engine?: SherpaTtsEngine): Promise<SherpaSynthesizer> {
    let tts: SherpaTts;
    try { tts = await (engine ?? nativeEngine()).createAsync(sherpaConfig(voice)); }
    catch (error) { throw new ProjectError('Voice model could not be loaded', { cause: error }); }
    const rate = tts.sampleRate;
    if (!Number.isSafeInteger(rate) || rate < 8_000 || rate > 48_000) {
      throw new ProjectError('Invalid voice sample rate');
    }
    return new SherpaSynthesizer(tts);
  }

  /** Release the loaded voice; transmissions in progress end without further sentences. */
  close(): void {
    this.tts = undefined;
  }

  /** Queue one sentence after the generations already requested; undefined once aborted or closed. */
  private speak(text: string, signal: AbortSignal): Promise<Uint8Array | undefined> {
    const generated = this.previous.then(async () => {
      const tts = this.tts;
      if (signal.aborted || !tts) return undefined;
      let audio: Awaited<ReturnType<SherpaTts['generateAsync']>>;
      try { audio = await tts.generateAsync({ text, sid: PIPER_SPEAKER, speed: 1 }); }
      catch (error) { throw new ProjectError('Speech synthesis failed', { cause: error }); }
      if (audio.sampleRate !== this.sampleRate) throw new ProjectError('Speech synthesis failed');
      return pcm16(audio.samples);
    });
    this.previous = generated.catch(() => undefined);
    return generated;
  }

  async *synthesize(text: AsyncIterable<string>, signal: AbortSignal): AsyncIterable<Uint8Array> {
    if (signal.aborted || !this.tts) return;
    let abort!: () => void;
    const aborted = new Promise<typeof stopped>(resolve => { abort = () => resolve(stopped); });
    signal.addEventListener('abort', abort, { once: true });
    /** Wait for a step, or stop at once on abort; a later failure of the step is ignored. */
    const unlessAborted = <T>(step: Promise<T>): Promise<T | typeof stopped> => {
      step.catch(() => { /* reported by the race unless the transmission was aborted */ });
      return Promise.race([step, aborted]);
    };
    // The text source belongs to the caller: it is not awaited after an abort.
    const pieces = text[Symbol.asyncIterator]();
    try {
      let buffer = '';
      for (;;) {
        const next = await unlessAborted(pieces.next());
        if (next === stopped || signal.aborted) return;
        const split = next.done ? { sentences: [spokenSentence(buffer)].filter(Boolean), rest: '' }
          : takeSentences(buffer + next.value);
        buffer = split.rest;
        for (const sentence of split.sentences) {
          const audio = await unlessAborted(this.speak(sentence, signal));
          if (audio === stopped || audio === undefined || signal.aborted) return;
          yield audio;
        }
        if (next.done) return;
      }
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
}
