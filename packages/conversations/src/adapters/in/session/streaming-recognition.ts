import type { TranscriptionModelFiles } from '../../out/voice-config.js';

export const SAMPLE_RATE = 16_000;
/** Silence added before the audio of a request: without it the model loses the first word. */
export const LEAD_PADDING_SAMPLES = SAMPLE_RATE;
/** Silence added at the end of a request so that the last words leave the model. */
export const TAIL_PADDING_SAMPLES = 0.8 * SAMPLE_RATE;

/** Messages from the transcriber to the recognition worker, one stream per request `id`. */
export type RecognitionRequest =
  | Readonly<{ type: 'audio'; id: number; samples: Float32Array }>
  | Readonly<{ type: 'finish'; id: number }>
  | Readonly<{ type: 'cancel'; id: number }>;

/** Messages from the recognition worker: model loading, then the outcome of each finished request. */
export type RecognitionReply =
  | Readonly<{ type: 'ready' }>
  | Readonly<{ type: 'failed'; message: string }>
  | Readonly<{ type: 'result'; id: number; text: string }>
  | Readonly<{ type: 'error'; id: number; message: string }>;

/** The `sherpa-onnx-node` configuration of a streaming transducer recognizer. */
export type OnlineRecognizerConfig = Readonly<{
  featConfig: Readonly<{ sampleRate: number; featureDim: number }>;
  modelConfig: Readonly<{
    transducer: Readonly<{ encoder: string; decoder: string; joiner: string }>;
    tokens: string;
    numThreads: number;
    provider: 'cpu';
    debug: number;
  }>;
  decodingMethod: 'greedy_search';
  enableEndpoint: number;
}>;

export type OnlineStream = Readonly<{
  acceptWaveform(waveform: Readonly<{ samples: Float32Array; sampleRate: number }>): void;
  inputFinished(): void;
}>;

/** The part of `sherpa-onnx-node`'s `OnlineRecognizer` used by the worker; every call is synchronous. */
export type OnlineRecognizer = Readonly<{
  createStream(): OnlineStream;
  isReady(stream: OnlineStream): boolean;
  decode(stream: OnlineStream): void;
  getResult(stream: OnlineStream): Readonly<{ text?: string }>;
}>;

export function onlineRecognizerConfig(files: TranscriptionModelFiles, numThreads: number): OnlineRecognizerConfig {
  return {
    featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      transducer: { encoder: files.encoder, decoder: files.decoder, joiner: files.joiner },
      tokens: files.tokens, numThreads, provider: 'cpu', debug: 0,
    },
    decodingMethod: 'greedy_search',
    // The end of a request is decided by the client with input.end, not by the recognizer.
    enableEndpoint: 0,
  };
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/**
 * Applies the requests of the transcriber to one recognizer, in arrival order: every frame is decoded as soon as it
 * arrives, so that at the end of a request only its last part is left.
 */
export class RecognitionHost {
  private readonly streams = new Map<number, OnlineStream>();
  private readonly failed = new Set<number>();

  constructor(private readonly recognizer: OnlineRecognizer, private readonly reply: (reply: RecognitionReply) => void) {}

  handle(request: RecognitionRequest): void {
    if (request.type === 'cancel') {
      this.streams.delete(request.id);
      this.failed.delete(request.id);
      return;
    }
    if (this.failed.has(request.id)) {
      // The error was already reported: the rest of the request is ignored.
      if (request.type === 'finish') this.failed.delete(request.id);
      return;
    }
    try {
      const stream = this.stream(request.id);
      if (request.type === 'audio') {
        stream.acceptWaveform({ samples: request.samples, sampleRate: SAMPLE_RATE });
        this.drain(stream);
        return;
      }
      stream.acceptWaveform({ samples: new Float32Array(TAIL_PADDING_SAMPLES), sampleRate: SAMPLE_RATE });
      stream.inputFinished();
      this.drain(stream);
      const text = this.recognizer.getResult(stream).text?.trim() ?? '';
      this.streams.delete(request.id);
      this.reply({ type: 'result', id: request.id, text });
    } catch (error) {
      this.streams.delete(request.id);
      if (request.type === 'audio') this.failed.add(request.id);
      this.reply({ type: 'error', id: request.id, message: message(error) });
    }
  }

  private stream(id: number): OnlineStream {
    let stream = this.streams.get(id);
    if (!stream) {
      stream = this.recognizer.createStream();
      stream.acceptWaveform({ samples: new Float32Array(LEAD_PADDING_SAMPLES), sampleRate: SAMPLE_RATE });
      this.streams.set(id, stream);
    }
    return stream;
  }

  private drain(stream: OnlineStream): void {
    while (this.recognizer.isReady(stream)) this.recognizer.decode(stream);
  }
}
