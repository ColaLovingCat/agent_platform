import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let database: DatabaseSync | null = null;

export function openSqlite(dbFile: string) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  database = new DatabaseSync(dbFile);
  return database;
}

function sqlite() {
  if (!database) throw new Error('SQLite is not open');
  return database;
}

export function sqliteExec(sql: string) {
  sqlite().exec(sql);
}

export function sqliteAll<T>(sql: string, ...params: unknown[]) {
  return sqlite().prepare(sql).all(...params) as T[];
}

export function sqliteGet<T>(sql: string, ...params: unknown[]) {
  return sqlite().prepare(sql).get(...params) as T | undefined;
}

export function sqliteRun(sql: string, ...params: unknown[]) {
  return sqlite().prepare(sql).run(...params);
}
