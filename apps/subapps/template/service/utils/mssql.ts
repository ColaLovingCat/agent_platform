import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;
let cachedPassword = '';

export function defaultConnectionFile(appRoot: string) {
  return path.join(appRoot, 'dbs', 'db_connect.json');
}

function redact(message: string) {
  if (!cachedPassword) return message;
  return message.split(cachedPassword).join('***');
}

function readConnectionString(connectionFile: string) {
  const fromEnv = process.env.MSSQL_CONNECTION?.trim();
  if (fromEnv) return fromEnv;
  if (!fs.existsSync(connectionFile)) throw new Error('MSSQL connection is not configured');
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(connectionFile, 'utf8'));
  } catch {
    throw new Error('MSSQL connection is not configured');
  }
  if (!Array.isArray(parsed)) throw new Error('MSSQL connection is not configured');
  const named = parsed.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const name = (item as { name?: unknown }).name;
    return typeof name === 'string' && name.trim().toLowerCase() === 'default';
  });
  const chosen = named ?? parsed[0];
  const connection = chosen && typeof chosen === 'object'
    ? (chosen as { connectionString?: unknown }).connectionString
    : undefined;
  if (typeof connection !== 'string' || !connection.trim()) {
    throw new Error('MSSQL connection is not configured');
  }
  return connection.trim();
}

export async function openMssql(connectionFile: string) {
  if (pool?.connected) return pool;
  const connectionString = readConnectionString(connectionFile);
  const match = connectionString.match(/(?:password|pwd)=([^;]*)/i);
  cachedPassword = match?.[1] || '';
  try {
    pool = await new sql.ConnectionPool(connectionString).connect();
    return pool;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MSSQL connection failed';
    throw new Error(redact(message));
  }
}

export async function mssqlQuery<T>(connectionFile: string, text: string) {
  const db = await openMssql(connectionFile);
  const result = await db.request().query<T>(text);
  return result.recordset;
}
