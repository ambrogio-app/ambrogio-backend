/** Keep Fastify's schema validator from changing received request values. */
export const httpAjvOptions = {
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  allErrors: false,
} as const;
