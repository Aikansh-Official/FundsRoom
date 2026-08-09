import 'dotenv/config';

const required = ['JWT_SECRET', 'DB_PASSWORD', 'CLIENT_ORIGIN'] as const;

for (const key of required) {
  if (!process.env[key] && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET?.trim().length ?? 0) < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  dbHost: process.env.DB_HOST?.trim() || 'localhost',
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbName: process.env.DB_NAME?.trim() || 'fundsroom',
  dbUser: process.env.DB_USER?.trim() || 'root',
  dbPassword: process.env.DB_PASSWORD ?? '',
  dbSsl: process.env.DB_SSL?.trim().toLowerCase() === 'true',
  dbSslCaBase64: process.env.DB_SSL_CA_BASE64?.trim() || '',
  jwtSecret: process.env.JWT_SECRET?.trim() || 'development-only-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwtIssuer: process.env.JWT_ISSUER?.trim() || 'fundsroom-api',
  jwtAudience: process.env.JWT_AUDIENCE?.trim() || 'fundsroom-web',
};
