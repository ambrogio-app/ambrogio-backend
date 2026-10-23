export default {
  instructions: process.env.AMBROGIO_ORCHESTRATOR_INSTRUCTIONS
    || "Choose the agent that should answer the family's latest message. Route general questions, conversation and unclear requests to generic. If the message answers a question from an agent, choose the same agent. Return only the selected agent identifier.",
  llm: {
    provider: process.env.AMBROGIO_ORCHESTRATOR_PROVIDER || 'mistral',
    model: process.env.AMBROGIO_ORCHESTRATOR_MODEL || 'mistral-medium-latest',
    apiKey: process.env.AMBROGIO_ORCHESTRATOR_API_KEY || process.env.MISTRAL_API_KEY,
    ...(process.env.AMBROGIO_ORCHESTRATOR_BASE_URL ? { baseURL: process.env.AMBROGIO_ORCHESTRATOR_BASE_URL } : {}),
    ...(process.env.AMBROGIO_ORCHESTRATOR_TEMPERATURE || process.env.AMBROGIO_ORCHESTRATOR_MAX_TOKENS ? {
      options: {
        ...(process.env.AMBROGIO_ORCHESTRATOR_TEMPERATURE ? {
          temperature: Number(process.env.AMBROGIO_ORCHESTRATOR_TEMPERATURE),
        } : {}),
        ...(process.env.AMBROGIO_ORCHESTRATOR_MAX_TOKENS ? {
          max_tokens: Number(process.env.AMBROGIO_ORCHESTRATOR_MAX_TOKENS),
        } : {}),
      },
    } : {}),
  },
};
