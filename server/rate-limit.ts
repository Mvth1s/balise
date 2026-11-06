/**
 * Rate limiting: 10 analyses per hour per client. The client IP is never
 * stored: the key is HMAC-SHA-256(RATE_LIMIT_SALT, ip). Keys expire with the
 * sliding window (well under 24 h).
 */
import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export interface RateLimitResult {
  success: boolean;
  /** Epoch ms at which a new attempt will be allowed. */
  reset: number;
}

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

export function hashClientKey(ip: string, salt: string): string {
  return createHmac('sha256', salt).update(ip).digest('hex');
}

/** Client IP as set by Vercel (or the local servers): x-real-ip, then x-forwarded-for. */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

export function createUpstashRateLimiter(redis: Redis): RateLimiter {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, '1 h'),
    prefix: 'balise:ratelimit',
    analytics: false,
  });
  return {
    limit: async (key) => {
      const { success, reset } = await ratelimit.limit(key);
      return { success, reset };
    },
  };
}

/** Sliding window log in memory (single process: local development and tests). */
export function createMemoryRateLimiter(
  max = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS,
  now: () => number = Date.now,
): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    limit: async (key) => {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((h) => h > t - windowMs);
      const success = recent.length < max;
      if (success) recent.push(t);
      if (recent.length > 0) hits.set(key, recent);
      else hits.delete(key);
      return { success, reset: success ? t : recent[0]! + windowMs };
    },
  };
}
