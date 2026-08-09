import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool, query } from '../database/pool.js';

async function main() {
  const sql = await readFile(resolve(process.cwd(), 'database', 'stock-requests.sql'), 'utf8');
  for (const statement of sql.split(';').map((item) => item.trim()).filter(Boolean)) await query(statement);
  console.log('Stock request table is ready.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
