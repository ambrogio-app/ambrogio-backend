import type { VoiceConfig } from '../../out/voice-config.js';
import { PiperSynthesizer, piperSampleRate } from './piper-synthesizer.js';
import type { SpeechComponents } from './speech-components.js';
import { VoskTranscriber } from './vosk-transcriber.js';

/** Build Vosk recognition and Piper synthesis from the validated voice configuration. */
export async function createLocalSpeechComponents(config: VoiceConfig): Promise<SpeechComponents> {
  const sampleRate = await piperSampleRate(config.piperModelPath);
  const transcriber = new VoskTranscriber(config.voskModelPath);
  const synthesizer = new PiperSynthesizer(config.piperBinaryPath, config.piperModelPath, sampleRate);
  return {
    transcriber,
    synthesizer,
    async close() {
      synthesizer.close();
      transcriber.close();
    },
  };
}
