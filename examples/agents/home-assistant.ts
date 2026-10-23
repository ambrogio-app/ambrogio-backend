export default {
  description: process.env.AMBROGIO_HOME_ASSISTANT_DESCRIPTION
    || "Reads the state of the home's lights, switches and sensors through Home Assistant and turns devices on or off.",
  instructions: process.env.AMBROGIO_HOME_ASSISTANT_INSTRUCTIONS
    || "You control the family's home through Home Assistant. Answer briefly. Choose freely among the available tools and use the ones the request needs. To answer a question about the state of a device or a sensor, read its current state and do not turn on, turn off or change anything. Change a device only when the user asks for a change. When the user refers to several devices, for example all the lights or the lights of a room, act on all of them, using the area or the device type when a tool allows it. Say that an action happened only after a tool has confirmed it; if a tool fails or a device is not available, say so.",
  llm: {
    provider: process.env.AMBROGIO_HOME_ASSISTANT_PROVIDER || 'mistral',
    model: process.env.AMBROGIO_HOME_ASSISTANT_MODEL || 'mistral-medium-latest',
    apiKey: process.env.AMBROGIO_HOME_ASSISTANT_API_KEY || process.env.MISTRAL_API_KEY,
    ...(process.env.AMBROGIO_HOME_ASSISTANT_BASE_URL ? { baseURL: process.env.AMBROGIO_HOME_ASSISTANT_BASE_URL } : {}),
    ...(process.env.AMBROGIO_HOME_ASSISTANT_TEMPERATURE || process.env.AMBROGIO_HOME_ASSISTANT_MAX_TOKENS ? {
      options: {
        ...(process.env.AMBROGIO_HOME_ASSISTANT_TEMPERATURE ? {
          temperature: Number(process.env.AMBROGIO_HOME_ASSISTANT_TEMPERATURE),
        } : {}),
        ...(process.env.AMBROGIO_HOME_ASSISTANT_MAX_TOKENS ? {
          max_tokens: Number(process.env.AMBROGIO_HOME_ASSISTANT_MAX_TOKENS),
        } : {}),
      },
    } : {}),
  },
  maxToolCalls: Number(process.env.AMBROGIO_HOME_ASSISTANT_MAX_TOOL_CALLS || 5),
  mcp: {
    url: process.env.AMBROGIO_HOME_ASSISTANT_MCP_URL,
    auth: process.env.AMBROGIO_HOME_ASSISTANT_AUTH_TYPE === 'oauth_client_credentials'
      ? {
        type: 'oauth_client_credentials',
        clientId: process.env.AMBROGIO_HOME_ASSISTANT_OAUTH_CLIENT_ID,
        clientSecret: process.env.AMBROGIO_HOME_ASSISTANT_OAUTH_CLIENT_SECRET,
        issuer: process.env.AMBROGIO_HOME_ASSISTANT_OAUTH_ISSUER,
        ...(process.env.AMBROGIO_HOME_ASSISTANT_OAUTH_SCOPE ? {
          scope: process.env.AMBROGIO_HOME_ASSISTANT_OAUTH_SCOPE,
        } : {}),
      }
      : { type: 'bearer', token: process.env.HOME_ASSISTANT_LONG_LIVED_ACCESS_TOKEN },
    ...(process.env.AMBROGIO_HOME_ASSISTANT_TOOLS ? {
      tools: process.env.AMBROGIO_HOME_ASSISTANT_TOOLS.split(',').map(name => name.trim()),
    } : {}),
  },
};
