import { describe, expect, it } from 'vitest';
import {
  clientIp,
  createMemoryRateLimiter,
  hashClientKey,
  RATE_LIMIT_MAX,
  rateLimitSubject,
} from './rate-limit.ts';

describe('rateLimitSubject', () => {
  it('keeps IPv4, unwraps mapped IPv4 and reduces IPv6 to its /64', () => {
    expect(rateLimitSubject('203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitSubject('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitSubject('2001:DB8:0001:0002:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(rateLimitSubject('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(rateLimitSubject('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(rateLimitSubject('2001:db8:1:2:3:4::')).toBe('2001:db8:1:2::/64');
    expect(rateLimitSubject('::1')).toBe('0:0:0:0::/64');
    expect(rateLimitSubject('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(rateLimitSubject('unknown')).toBe('unknown');
  });
});

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
