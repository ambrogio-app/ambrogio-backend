const itEngine = process.env.AMBROGIO_IT_VOICE_ENGINE || 'piper';
const enEngine = process.env.AMBROGIO_EN_VOICE_ENGINE || 'piper';

export default {
  languages: {
    it: {
      voskModelPath: process.env.AMBROGIO_IT_VOSK_MODEL_PATH || '/opt/ambrogio/models/vosk-model-small-it-0.22',
      voiceEngine: itEngine,
      voiceModelDir: process.env.AMBROGIO_IT_VOICE_MODEL_DIR || (itEngine === 'kokoro'
        ? '/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0' : '/opt/ambrogio/voices/vits-piper-it_IT-paola-medium'),
      ...(itEngine === 'kokoro' ? {
        voiceSpeaker: Number(process.env.AMBROGIO_IT_VOICE_SPEAKER || 35),
        voiceLanguage: process.env.AMBROGIO_IT_VOICE_LANGUAGE || 'it',
      } : {}),
    },
    en: {
      voskModelPath: process.env.AMBROGIO_EN_VOSK_MODEL_PATH || '/opt/ambrogio/models/vosk-model-small-en-us-0.15',
      voiceEngine: enEngine,
      voiceModelDir: process.env.AMBROGIO_EN_VOICE_MODEL_DIR || (enEngine === 'kokoro'
        ? '/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0' : '/opt/ambrogio/voices/vits-piper-en_US-kristin-medium'),
      ...(enEngine === 'kokoro' ? {
        voiceSpeaker: Number(process.env.AMBROGIO_EN_VOICE_SPEAKER || 3),
        voiceLanguage: process.env.AMBROGIO_EN_VOICE_LANGUAGE || 'en',
      } : {}),
    },
  },
};
