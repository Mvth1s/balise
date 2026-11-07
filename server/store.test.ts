import type { AnalysisStatus } from '@balise/analyzer/types';
import { describe, expect, it, vi } from 'vitest';
import {
  ANALYSIS_TTL_SECONDS,
  createMemoryStore,
  createRedisStore,
  redisCredentials,
  type RedisLike,
} from './store.ts';

const status: AnalysisStatus = {
  id: 'abcdefgh',
  url: 'https://exemple.fr/',
  state: 'pending',
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
};

describe('memory store', () => {
  it('stores copies and expires after the TTL', async () => {
    let t = 0;
    const store = createMemoryStore(10, () => t);
    await store.put(status);
    const read = await store.get('abcdefgh');
    expect(read).toEqual(status);
    read!.state = 'done';
    expect((await store.get('abcdefgh'))?.state).toBe('pending');
    await store.putScreenshot('abcdefgh', Buffer.from([1, 2]));
    expect(await store.getScreenshot('abcdefgh')).toEqual(Buffer.from([1, 2]));
    t = 10_000;
    expect(await store.get('abcdefgh')).toBeNull();
    expect(await store.getScreenshot('abcdefgh')).toBeNull();
    expect(await store.get('missing')).toBeNull();
  });
});

describe('redis store', () => {
  it('uses namespaced keys and a 30-day TTL', async () => {
    const data = new Map<string, unknown>();
    const redis: RedisLike = {
      get: async <T>(key: string) => (data.get(key) as T) ?? null,
      set: vi.fn(async (key: string, value: unknown) => {
        data.set(key, value);
        return 'OK';
      }),
      getdel: async <T>(key: string) => {
        const value = (data.get(key) as T) ?? null;
        data.delete(key);
        return value;
      },
    };
    const store = createRedisStore(redis);
    await store.put(status);
    expect(redis.set).toHaveBeenCalledWith('balise:analysis:abcdefgh', status, {
      ex: ANALYSIS_TTL_SECONDS,
    });
    expect(ANALYSIS_TTL_SECONDS).toBe(2_592_000);
    expect(await store.get('abcdefgh')).toEqual(status);
    await store.putScreenshot('abcdefgh', Buffer.from('jpeg'));
    expect(data.get('balise:analysis:abcdefgh:screenshot')).toEqual({
      jpeg: Buffer.from('jpeg').toString('base64'),
    });
    expect(await store.getScreenshot('abcdefgh')).toEqual(Buffer.from('jpeg'));
    expect(await store.getScreenshot('other')).toBeNull();
    // Report tokens: single use.
    await store.putToken('abcdefgh', 'n1', 60);
    expect(await store.consumeToken('abcdefgh', 'bad')).toBe(false);
    await store.putToken('abcdefgh', 'n1', 60);
    expect(await store.consumeToken('abcdefgh', 'n1')).toBe(true);
    expect(await store.consumeToken('abcdefgh', 'n1')).toBe(false);
  });
});

describe('redisCredentials', () => {
  it('reads the Vercel marketplace names, then the Upstash names', () => {
    expect(redisCredentials({ KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' })).toEqual({
      url: 'u',
      token: 't',
    });
    expect(
      redisCredentials({ UPSTASH_REDIS_REST_URL: 'u2', UPSTASH_REDIS_REST_TOKEN: 't2' }),
    ).toEqual({ url: 'u2', token: 't2' });
    expect(redisCredentials({ KV_REST_API_URL: 'u' })).toBeNull();
  });
});
