import type { NextFunction, Request, Response } from 'express';
import { redact } from './logger';

export function accessLog(logger: { write(entry: Record<string, unknown>): void }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api') || req.path.startsWith('/api/logs') || req.method === 'OPTIONS') {
      next();
      return;
    }
    res.on('finish', () => {
      logger.write({
        kind: 'api',
        method: req.method,
        path: req.path,
        query: redact(req.query),
        body: redact(req.body),
        status: res.statusCode,
        ok: res.statusCode < 400,
      });
    });
    next();
  };
}
