import type { VoiceConfig } from '../../out/voice-config.js';

/** Turns the PCM16 mono 16 kHz audio of one request into text; a thrown error is an unusable transcription. */
export interface Transcriber {
  transcribe(audio: AsyncIterable<Uint8Array>): Promise<string>;
}

/** Speaks text as it is produced, emitting PCM16 mono audio at `sampleRate` until the text ends or the signal aborts. */
export interface Synthesizer {
  readonly sampleRate: number;
  synthesize(text: AsyncIterable<string>, signal: AbortSignal): AsyncIterable<Uint8Array>;
}

export type SpeechComponents = Readonly<{
  transcriber: Transcriber;
  synthesizer: Synthesizer;
  close(): Promise<void>;
}>;

export type SpeechComponentsFactory = (config: VoiceConfig) => SpeechComponents | Promise<SpeechComponents>;
