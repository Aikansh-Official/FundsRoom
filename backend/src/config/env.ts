import 'dotenv/config';

const required = ['JWT_SECRET'] as const;

for (const key of required) {
  if (!process.env[key] && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  dbHost: process.env.DB_HOST?.trim() || 'localhost',
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbName: process.env.DB_NAME?.trim() || 'fundsroom',
  dbUser: process.env.DB_USER?.trim() || 'root',
  dbPassword: process.env.DB_PASSWORD ?? '',
  jwtSecret: process.env.JWT_SECRET?.trim() || 'development-only-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
};
