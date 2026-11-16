import fs from 'node:fs';
import path from 'node:path';

const REDACT_KEYS = new Set(['password', 'pwd', 'passphrase', 'connectionstring', 'authorization']);

function localStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return { day, time: `${day} ${time}` };
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACT_KEYS.has(key.toLowerCase()) ? '***' : redact(item, depth + 1);
  }
  return output;
}

export function createLogger(logDir: string) {
  fs.mkdirSync(logDir, { recursive: true });
  return {
    write(entry: Record<string, unknown>) {
      const stamp = localStamp();
      const file = path.join(logDir, `${stamp.day}.log`);
      fs.appendFileSync(file, `${JSON.stringify({ time: stamp.time, ...entry })}\n`);
    },
  };
}

export function readLog(logDir: string, date: string) {
  const file = path.join(logDir, `${date}.log`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}
