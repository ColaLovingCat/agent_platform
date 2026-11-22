import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { createRequire } from 'node:module';
import { USER_ROLES, type User, type UserRole } from '../shared/datas.type';
import { accessLog } from './utils/access-log';
import { createLogger, readLog, redact } from './utils/logger';
import { openSqlite, sqliteAll, sqliteExec, sqliteGet, sqliteRun } from './utils/sqlite';
import { openApiSpec, swaggerHtml } from './swagger';

const isProd = process.env.NODE_ENV === 'production';
const APP_ROOT = isProd
  ? path.dirname(path.resolve(process.argv[1] || process.cwd()))
  : process.cwd();

if (!isProd) {
  dotenv.config({ path: path.join(APP_ROOT, '.env.development') });
}

const PORT = Number(process.env.PORT) || 3000;
const SQLITE_FILE = path.join(APP_ROOT, 'dbs', 'datas.sqlite');
const UPLOAD_DIR = path.join(APP_ROOT, 'uploads');
const LOG_DIR = path.join(APP_ROOT, 'logs');
const logger = createLogger(LOG_DIR);

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nameOf(value: unknown) {
  const name = text(value);
  if (!name || name.length > 64) throw new ApiError(400, '请填写姓名');
  return name;
}

function emailOf(value: unknown) {
  const email = text(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    throw new ApiError(400, '邮箱格式不正确');
  }
  return email;
}

function roleOf(value: unknown): UserRole {
  const role = text(value);
  if (!USER_ROLES.some((item) => item.value === role)) throw new ApiError(400, '角色只能是管理员或用户');
  return role as UserRole;
}

function isUniqueError(err: unknown) {
  return err instanceof Error && err.message.includes('UNIQUE');
}

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(accessLog(logger));

function sendError(res: express.Response, err: unknown) {
  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof Error ? err.message : '请求失败';
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, error: message });
}

app.get('/api/health', (_req, res) => {
  res.json({ success: true, sqlite: SQLITE_FILE });
});

app.post('/api/logs', (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, '日志内容应为对象');
    const record = body as Record<string, unknown>;
    const kind = typeof record.kind === 'string' ? record.kind.trim() : '';
    if (!kind || kind.length > 32) throw new ApiError(400, '请填写 kind');
    logger.write({
      ...(redact(record) as Record<string, unknown>),
      kind,
      userAgent: req.get('user-agent') || '',
    });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/logs/:date', (req, res) => {
  try {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, '日期格式应为 YYYY-MM-DD');
    const content = readLog(LOG_DIR, date);
    if (content == null) throw new ApiError(404, '这一天没有日志');
    res.json({ success: true, date, content });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/users', (req, res) => {
  try {
    const q = text(req.query.q).toLowerCase();
    const rows = q
      ? sqliteAll<UserRow>(
        `SELECT id, name, email, role, created_at, updated_at
         FROM users
         WHERE instr(lower(name), ?) > 0 OR instr(lower(email), ?) > 0
         ORDER BY id DESC`,
        q,
        q,
      )
      : sqliteAll<UserRow>(
        `SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY id DESC`,
      );
    res.json({ success: true, users: rows.map(toUser) });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/users/save', (req, res) => {
  try {
    const name = nameOf(req.body?.name);
    const email = emailOf(req.body?.email);
    const role = roleOf(req.body?.role);
    const now = new Date().toISOString();
    const rawId = req.body?.id;
    if (rawId != null && rawId !== '') {
      const id = Number(rawId);
      if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '找不到这个用户');
      const existing = sqliteGet<{ id: number }>(`SELECT id FROM users WHERE id = ?`, id);
      if (!existing) throw new ApiError(404, '找不到这个用户');
      try {
        sqliteRun(
          `UPDATE users SET name = ?, email = ?, role = ?, updated_at = ? WHERE id = ?`,
          name,
          email,
          role,
          now,
          id,
        );
      } catch (err) {
        if (isUniqueError(err)) throw new ApiError(400, '邮箱已存在');
        throw err;
      }
    } else {
      try {
        sqliteRun(
          `INSERT INTO users (name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          name,
          email,
          role,
          now,
          now,
        );
      } catch (err) {
        if (isUniqueError(err)) throw new ApiError(400, '邮箱已存在');
        throw err;
      }
    }
    const saved = sqliteGet<UserRow>(
      `SELECT id, name, email, role, created_at, updated_at FROM users WHERE email = ?`,
      email,
    );
    res.json({ success: true, user: saved ? toUser(saved) : null });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/users/remove', (req, res) => {
  try {
    const id = Number(req.body?.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '找不到这个用户');
    const result = sqliteRun(`DELETE FROM users WHERE id = ?`, id);
    if (result.changes < 1) throw new ApiError(404, '找不到这个用户');
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

function swaggerUiDir() {
  const bundled = path.join(APP_ROOT, 'swagger-ui');
  if (fs.existsSync(path.join(bundled, 'swagger-ui-bundle.js'))) return bundled;
  const require = createRequire(path.join(APP_ROOT, 'package.json'));
  return path.dirname(require.resolve('swagger-ui-dist/package.json'));
}

function mountSwagger() {
  app.get('/swagger.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/swagger', express.static(swaggerUiDir(), { index: false }));
  app.get(['/swagger', '/swagger/'], (_req, res) => {
    res.type('html').send(swaggerHtml);
  });
}

function resolveSsl(file: string) {
  return path.isAbsolute(file) ? file : path.resolve(APP_ROOT, file);
}

async function startServer() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  openSqlite(SQLITE_FILE);
  sqliteExec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  mountSwagger();
  app.get('/', (_req, res) => {
    res.redirect('/apps/template/');
  });

  const pfxFile = process.env.SSL_PFX;
  const certFile = process.env.SSL_CERT;
  const keyFile = process.env.SSL_KEY;
  let server: http.Server | https.Server;
  let scheme = 'http';
  if (pfxFile) {
    server = https.createServer(
      {
        pfx: fs.readFileSync(resolveSsl(pfxFile)),
        passphrase: process.env.SSL_PASSPHRASE,
      },
      app,
    );
    scheme = 'https';
  } else if (certFile && keyFile) {
    server = https.createServer(
      {
        cert: fs.readFileSync(resolveSsl(certFile)),
        key: fs.readFileSync(resolveSsl(keyFile)),
      },
      app,
    );
    scheme = 'https';
  } else {
    server = http.createServer(app);
  }

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Template API on ${scheme}://localhost:${PORT}`);
    console.log(`Swagger: ${scheme}://localhost:${PORT}/swagger`);
    console.log(`SQLite: ${SQLITE_FILE}`);
    if (!isProd) console.log(`Dev UI: ${scheme}://localhost:${PORT}/apps/template/`);
  });
}

startServer().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
