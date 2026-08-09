import mysql, { type PoolConnection } from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  ssl: env.dbSsl ? {
    rejectUnauthorized: true,
    ...(env.dbSslCaBase64 ? { ca: Buffer.from(env.dbSslCaBase64, 'base64').toString('utf8') } : {}),
  } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
});

export type QueryResult<T> = { rows: T[] };

export type DatabaseClient = {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
};

function normalizeSql(text: string, values: unknown[]) {
  const expandedValues: unknown[] = [];
  const sql = text.replace(/\$(\d+)/g, (_match, index: string) => {
    expandedValues.push(values[Number(index) - 1]);
    return '?';
  });
  return { sql, values: expandedValues.length > 0 ? expandedValues : values };
}

async function execute<T = Record<string, unknown>>(client: PoolConnection | typeof pool, text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  const normalized = normalizeSql(text, values);
  const [rows] = await client.query(normalized.sql, normalized.values);
  return { rows: (Array.isArray(rows) ? rows : [rows]) as T[] };
}

export async function query<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  return execute<T>(pool, text, values);
}

export async function withTransaction<T>(work: (client: DatabaseClient) => Promise<T>) {
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    const result = await work({ query: <R = Record<string, unknown>>(text: string, values: unknown[] = []) => execute<R>(client, text, values) });
    await client.commit();
    return result;
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}
