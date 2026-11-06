import { describe, expect, it } from 'vitest';
import { clientIp, createMemoryRateLimiter, hashClientKey, RATE_LIMIT_MAX } from './rate-limit.ts';

describe('hashClientKey', () => {
  it('is a salted HMAC that never contains the IP', () => {
    const a = hashClientKey('203.0.113.7', 'sel-1');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203.0.113.7');
    expect(hashClientKey('203.0.113.7', 'sel-1')).toBe(a);
    expect(hashClientKey('203.0.113.7', 'sel-2')).not.toBe(a);
  });
});

describe('clientIp', () => {
  it('prefers x-real-ip, then the first x-forwarded-for entry', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' }))).toBe(
      '1.2.3.4',
    );
    expect(clientIp(new Headers({ 'x-forwarded-for': ' 5.6.7.8 , 9.9.9.9' }))).toBe('5.6.7.8');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});

describe('memory rate limiter', () => {
  it('allows 10 per sliding hour and per key', async () => {
    let t = 1_000;
    const limiter = createMemoryRateLimiter(undefined, undefined, () => t);
    expect(RATE_LIMIT_MAX).toBe(10);
    for (let i = 0; i < 10; i += 1) {
      expect((await limiter.limit('a')).success).toBe(true);
      t += 60_000;
    }
    const blocked = await limiter.limit('a');
    expect(blocked).toEqual({ success: false, reset: 1_000 + 3_600_000 });
    expect((await limiter.limit('b')).success).toBe(true);
    t = 1_000 + 3_600_001;
    expect((await limiter.limit('a')).success).toBe(true);
  });
});
