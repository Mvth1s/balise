/**
 * Rate limiting: 10 analyses per hour per client (IPv4 address or IPv6 /64)
 * plus a global ceiling of 100 analyses per hour. The client IP is never
 * stored: the key is HMAC-SHA-256(RATE_LIMIT_SALT, subject). Keys expire with
 * the sliding window (well under 24 h).
 */
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';
import { ipAddress } from '@vercel/functions';

export const RATE_LIMIT_MAX = 10;
export const GLOBAL_RATE_LIMIT_MAX = 100;
export const GLOBAL_RATE_LIMIT_KEY = 'global';
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
  const real = ipAddress(headers)?.trim();
  if (real) return real;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

/**
 * Rate-limit subject of an IP: the IPv4 address itself (IPv4-mapped IPv6
 * included), or the /64 prefix of an IPv6 address, since one client usually
 * owns a whole /64. Anything else is returned unchanged.
 */
export function rateLimitSubject(ip: string): string {
  const addr = ip.trim().toLowerCase().replace(/%.*$/, '');
  if (isIP(addr) === 4) return addr;
  if (isIP(addr) !== 6) return ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped) return mapped[1]!;
  // Hextets before the first "::" (zeros fill the gap) are enough for a /64.
  const [head = '', tail] = addr.split('::');
  const parts = head === '' ? [] : head.split(':');
  if (tail !== undefined) while (parts.length < 4) parts.push('0');
  return `${parts
    .slice(0, 4)
    .map((h) => parseInt(h, 16).toString(16))
    .join(':')}::/64`;
}

export function createUpstashRateLimiter(
  redis: Redis,
  max = RATE_LIMIT_MAX,
  prefix = 'balise:ratelimit',
): RateLimiter {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, '1 h'),
    prefix,
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
