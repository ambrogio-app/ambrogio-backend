export default {
  host: process.env.AMBROGIO_HTTP_HOST || '0.0.0.0',
  port: Number(process.env.AMBROGIO_HTTP_PORT || 3000),
  allowedOrigins: process.env.AMBROGIO_ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) || [],
  publicHttps: process.env.AMBROGIO_PUBLIC_HTTPS === 'true',
  ...(!process.env.AMBROGIO_HSTS_MAX_AGE_SECONDS ? {} : {
    hstsMaxAgeSeconds: Number(process.env.AMBROGIO_HSTS_MAX_AGE_SECONDS),
  }),
};
