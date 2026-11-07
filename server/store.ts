/**
 * Analysis storage behind the `AnalysisStore` interface: Upstash Redis in
 * production, in-memory fallback for local development and tests.
 * Every record expires after 30 days (automatic purge).
 */
import type { AnalysisStatus } from '@balise/analyzer/types';
import { Redis } from '@upstash/redis';

export const ANALYSIS_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AnalysisStore {
  get(id: string): Promise<AnalysisStatus | null>;
  /** Creates or replaces the status (TTL reset to 30 days). */
  put(status: AnalysisStatus): Promise<void>;
  getScreenshot(id: string): Promise<Buffer | null>;
  putScreenshot(id: string, jpeg: Buffer): Promise<void>;
  /** Stores the nonce of the single report token of an analysis. */
  putToken(id: string, nonce: string, ttlSeconds: number): Promise<void>;
  /** Atomically deletes the stored nonce; true only if it matched (single use). */
  consumeToken(id: string, nonce: string): Promise<boolean>;
}

/** Subset of the @upstash/redis client used here (injectable in tests). */
export interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options: { ex: number }): Promise<unknown>;
  getdel<T>(key: string): Promise<T | null>;
}

const statusKey = (id: string): string => `balise:analysis:${id}`;
const screenshotKey = (id: string): string => `balise:analysis:${id}:screenshot`;
const tokenKey = (id: string): string => `balise:analysis:${id}:token`;

export function createRedisStore(
  redis: RedisLike,
  ttlSeconds = ANALYSIS_TTL_SECONDS,
): AnalysisStore {
  return {
    get: (id) => redis.get<AnalysisStatus>(statusKey(id)),
    put: async (status) => {
      await redis.set(statusKey(status.id), status, { ex: ttlSeconds });
    },
    getScreenshot: async (id) => {
      const value = await redis.get<{ jpeg: string }>(screenshotKey(id));
      return value && typeof value.jpeg === 'string' ? Buffer.from(value.jpeg, 'base64') : null;
    },
    putScreenshot: async (id, jpeg) => {
      await redis.set(screenshotKey(id), { jpeg: jpeg.toString('base64') }, { ex: ttlSeconds });
    },
    putToken: async (id, nonce, ex) => {
      await redis.set(tokenKey(id), { nonce }, { ex });
    },
    consumeToken: async (id, nonce) =>
      (await redis.getdel<{ nonce?: unknown }>(tokenKey(id)))?.nonce === nonce,
  };
}

/**
 * In-memory store (single process). Values are deep-copied so callers never
 * share mutable state with the store, as with Redis.
 */
export function createMemoryStore(
  ttlSeconds = ANALYSIS_TTL_SECONDS,
  now: () => number = Date.now,
): AnalysisStore {
  const statuses = new Map<string, { value: string; expires: number }>();
  const screenshots = new Map<string, { value: Buffer; expires: number }>();
  const tokens = new Map<string, { value: string; expires: number }>();
  const alive = <T extends { expires: number }>(
    map: Map<string, T>,
    key: string,
  ): T | undefined => {
    const entry = map.get(key);
    if (entry && entry.expires <= now()) {
      map.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    get: async (id) => {
      const entry = alive(statuses, id);
      return entry ? (JSON.parse(entry.value) as AnalysisStatus) : null;
    },
    put: async (status) => {
      statuses.set(status.id, {
        value: JSON.stringify(status),
        expires: now() + ttlSeconds * 1000,
      });
    },
    getScreenshot: async (id) => {
      const entry = alive(screenshots, id);
      return entry ? Buffer.from(entry.value) : null;
    },
    putScreenshot: async (id, jpeg) => {
      screenshots.set(id, { value: Buffer.from(jpeg), expires: now() + ttlSeconds * 1000 });
    },
    putToken: async (id, nonce, ex) => {
      tokens.set(id, { value: nonce, expires: now() + ex * 1000 });
    },
    consumeToken: async (id, nonce) => {
      const entry = alive(tokens, id);
      tokens.delete(id);
      return entry?.value === nonce;
    },
  };
}

/** Upstash REST credentials (Vercel marketplace names first). */
export function redisCredentials(env: NodeJS.ProcessEnv): { url: string; token: string } | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function createRedisClient(credentials: { url: string; token: string }): Redis {
  return new Redis({ url: credentials.url, token: credentials.token });
}
