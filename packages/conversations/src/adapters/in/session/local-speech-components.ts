import { voiceModel, type VoiceConfig } from '../../out/voice-config.js';
import { SherpaSynthesizer } from './sherpa-synthesizer.js';
import type { SpeechComponents } from './speech-components.js';
import { VoskTranscriber } from './vosk-transcriber.js';

/** Build Vosk recognition and sherpa-onnx synthesis from the validated voice configuration. */
export async function createLocalSpeechComponents(config: VoiceConfig): Promise<SpeechComponents> {
  const synthesizer = await SherpaSynthesizer.load(await voiceModel(config));
  let transcriber: VoskTranscriber;
  try { transcriber = new VoskTranscriber(config.voskModelPath); }
  catch (error) { synthesizer.close(); throw error; }
  return {
    transcriber,
    synthesizer,
    async close() {
      synthesizer.close();
      transcriber.close();
    },
  };
}
