import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../config/env.js';
import { pool, query } from '../database/pool.js';

async function main() {
  const schemaPath = resolve(process.cwd(), 'database', 'schema.sql');
  const schema = await readFile(schemaPath, 'utf8');
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await query(statement);
  console.log('Database schema created successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
