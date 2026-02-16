/**
 * In-memory rate limiter for API routes. No PII stored; keys are IP or user id.
 */
import type { Request, Response, NextFunction } from 'express';

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 10;

function getKey(req: Request & { userId?: string }): string {
  if (req.userId) return `user:${req.userId}`;
  const ip = (req as Request).ip ?? req.socket?.remoteAddress ?? 'unknown';
  return `ip:${ip}`;
}

export function lessonGenerateRateLimit(req: Request & { userId?: string }, res: Response, next: NextFunction): void {
  const key = getKey(req);
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many lesson generation requests. Try again later.' });
    return;
  }
  next();
}
