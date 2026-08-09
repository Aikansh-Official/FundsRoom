import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

async function main() {
  if (!/^[A-Za-z0-9_]+$/.test(env.dbName)) throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
  const connection = await mysql.createConnection({
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
  console.log(`Database ${env.dbName} is ready.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
