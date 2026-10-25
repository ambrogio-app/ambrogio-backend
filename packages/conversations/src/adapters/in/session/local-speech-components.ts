import { transcriptionModel, voiceModel, type VoiceConfig } from '../../out/voice-config.js';
import { SherpaSynthesizer } from './sherpa-synthesizer.js';
import { SherpaTranscriber } from './sherpa-transcriber.js';
import type { SpeechComponents } from './speech-components.js';

/** Build sherpa-onnx recognition and synthesis from the validated voice configuration. */
export async function createLocalSpeechComponents(config: VoiceConfig): Promise<SpeechComponents> {
  const synthesizer = await SherpaSynthesizer.load(await voiceModel(config));
  let transcriber: SherpaTranscriber;
  try { transcriber = await SherpaTranscriber.load(await transcriptionModel(config)); }
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
