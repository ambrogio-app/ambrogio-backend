import { transcriptionModel, voiceModel, type VoiceConfig } from '../../out/voice-config.js';
import { SherpaSynthesizer } from './sherpa-synthesizer.js';
import type { SpeechComponents } from './speech-components.js';
import { StreamingTranscriber } from './streaming-transcriber.js';

/** Build sherpa-onnx streaming recognition and synthesis from the validated voice configuration. */
export async function createLocalSpeechComponents(config: VoiceConfig): Promise<SpeechComponents> {
  const synthesizer = await SherpaSynthesizer.load(await voiceModel(config));
  let transcriber: StreamingTranscriber;
  try { transcriber = await StreamingTranscriber.load(await transcriptionModel(config)); }
  catch (error) { synthesizer.close(); throw error; }
  return {
    transcriber,
    synthesizer,
    async close() {
      synthesizer.close();
      await transcriber.close();
    },
  };
}
