export default {
  languages: {
    it: {
      voskModelPath: process.env.AMBROGIO_IT_VOSK_MODEL_PATH || '/opt/ambrogio/models/vosk-model-small-it-0.22',
      voiceEngine: 'kokoro',
      voiceModelDir: process.env.AMBROGIO_IT_VOICE_MODEL_DIR || '/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0',
      voiceSpeaker: Number(process.env.AMBROGIO_IT_VOICE_SPEAKER || 35),
      voiceLanguage: process.env.AMBROGIO_IT_VOICE_LANGUAGE || 'it',
    },
    en: {
      voskModelPath: process.env.AMBROGIO_EN_VOSK_MODEL_PATH || '/opt/ambrogio/models/vosk-model-small-en-us-0.15',
      voiceEngine: 'kokoro',
      voiceModelDir: process.env.AMBROGIO_EN_VOICE_MODEL_DIR || '/opt/ambrogio/kokoro/kokoro-multi-lang-v1_0',
      voiceSpeaker: Number(process.env.AMBROGIO_EN_VOICE_SPEAKER || 3),
      voiceLanguage: process.env.AMBROGIO_EN_VOICE_LANGUAGE || 'en',
    },
  },
};
