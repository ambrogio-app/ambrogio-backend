export default {
  description: process.env.AMBROGIO_GENERIC_DESCRIPTION || 'Answers general questions and makes conversation.',
  instructions: process.env.AMBROGIO_GENERIC_INSTRUCTIONS
    || 'You are Ambrogio, the family assistant. Answer briefly and plainly. Requests may come from speech recognition and contain misheard words; interpret them in context. If you cannot understand a request, ask the family to repeat it.',
  llm: {
    provider: process.env.AMBROGIO_GENERIC_PROVIDER || 'mistral',
    model: process.env.AMBROGIO_GENERIC_MODEL || 'mistral-medium-latest',
    apiKey: process.env.AMBROGIO_GENERIC_API_KEY || process.env.MISTRAL_API_KEY,
    ...(process.env.AMBROGIO_GENERIC_BASE_URL ? { baseURL: process.env.AMBROGIO_GENERIC_BASE_URL } : {}),
    ...(process.env.AMBROGIO_GENERIC_TEMPERATURE || process.env.AMBROGIO_GENERIC_MAX_TOKENS ? {
      options: {
        ...(process.env.AMBROGIO_GENERIC_TEMPERATURE ? {
          temperature: Number(process.env.AMBROGIO_GENERIC_TEMPERATURE),
        } : {}),
        ...(process.env.AMBROGIO_GENERIC_MAX_TOKENS ? {
          max_tokens: Number(process.env.AMBROGIO_GENERIC_MAX_TOKENS),
        } : {}),
      },
    } : {}),
  },
};
