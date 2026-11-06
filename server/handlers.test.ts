import {
  AnalysisAbortedError,
  AnalysisError,
  type AnalysisReport,
  type AnalysisStatus,
  type LookupAll,
} from '@balise/analyzer';
import { describe, expect, it, vi } from 'vitest';
import { FAKE_SCREENSHOT, fakeAnalyzePage, isFakeAnalyzerEnabled } from './fake-analyzer.ts';
import { createHandlers, type AnalyzeFn, type HandlerDeps } from './handlers.ts';
import { createMemoryRateLimiter } from './rate-limit.ts';
import { createMemoryStore } from './store.ts';

const publicLookup: LookupAll = async () => [{ address: '93.184.215.14', family: 4 }];
const BASE = 'http://localhost';

function setup(overrides: Partial<HandlerDeps> = {}) {
  const store = createMemoryStore();
  const jobs: Promise<unknown>[] = [];
  let n = 0;
  const handler = createHandlers({
    env: {},
    store,
    rateLimiter: createMemoryRateLimiter(),
    lookup: publicLookup,
    waitUntil: (p) => {
      jobs.push(p);
    },
    newId: () => `analysis${(n += 1)}`,
    log: () => undefined,
    ...overrides,
  });
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    handler(
      new Request(`${BASE}/api/analyses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  const get = (path: string, method = 'GET') => handler(new Request(`${BASE}${path}`, { method }));
  const settle = () => Promise.all(jobs);
  return { store, handler, post, get, settle, jobs };
}

const report = (id: string): AnalysisReport =>
  ({ id, hasScreenshot: true }) as unknown as AnalysisReport;

const okAnalyze: AnalyzeFn = async (_url, options) => {
  await options.onStep?.('loading');
  await options.onStep?.('testing');
  await options.onStep?.('scoring');
  return { report: report(options.id!), screenshot: Buffer.from([0xff, 0xd8, 0xff]) };
};

async function body<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe('POST /api/analyses', () => {
  it('validates, answers 202 and runs the analysis in waitUntil', async () => {
    const steps: string[] = [];
    const { post, get, settle, store } = setup({
      analyze: async (url, options) => {
        expect(url).toBe('https://exemple.fr/page');
        const original = options.onStep!;
        return okAnalyze(url, {
          ...options,
          onStep: async (s) => {
            await original(s);
            steps.push((await store.get(options.id!))!.step!);
          },
        });
      },
    });
    const res = await post({ url: ' https://exemple.fr/page#ancre ' });
    expect(res.status).toBe(202);
    expect(res.headers.get('location')).toBe('/api/analyses/analysis1');
    expect(await body(res)).toEqual({
      id: 'analysis1',
      url: 'https://exemple.fr/page',
      state: 'pending',
    });
    await settle();
    expect(steps).toEqual(['loading', 'testing', 'scoring']);
    const status = await body<AnalysisStatus>(await get('/api/analyses/analysis1'));
    expect(status).toMatchObject({
      state: 'done',
      step: 'scoring',
      report: { id: 'analysis1', hasScreenshot: true },
    });
    const shot = await get('/api/analyses/analysis1/screenshot');
    expect(shot.status).toBe(200);
    expect(shot.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await shot.arrayBuffer())).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it('refuses malformed bodies and invalid URLs with 400 invalid_url', async () => {
    const { post } = setup();
    for (const b of [
      'pas du json',
      '{}',
      'null',
      JSON.stringify({ url: 3 }),
      JSON.stringify({ url: 'x'.repeat(9000) }),
    ]) {
      const res = await post(b);
      expect(res.status).toBe(400);
      expect((await body<{ error: { code: string } }>(res)).error.code).toBe('invalid_url');
    }
    const res = await post({ url: 'pas une url' });
    expect(res.status).toBe(400);
    const err = (await body<{ error: { code: string; message: string } }>(res)).error;
    expect(err.code).toBe('invalid_url');
    expect(err.message).toMatch(/URL valide/);
  });

  it('refuses private targets, forbidden schemes and ports with 422 forbidden_target', async () => {
    const { post } = setup({ lookup: async () => [{ address: '10.0.0.1', family: 4 }] });
    for (const url of [
      'http://127.0.0.1/',
      'http://[::1]/',
      'file:///etc/passwd',
      'http://exemple.fr:8080/',
      'http://intranet.exemple.fr/',
      'http://localhost/',
    ]) {
      const res = await post({ url });
      expect(res.status, url).toBe(422);
      expect((await body<{ error: { code: string } }>(res)).error.code).toBe('forbidden_target');
    }
  });

  it('maps DNS failures to 422 dns_failure', async () => {
    const { post } = setup({
      lookup: async () => {
        throw new Error('ENOTFOUND');
      },
    });
    const res = await post({ url: 'https://absent.exemple/' });
    expect(res.status).toBe(422);
    expect((await body<{ error: { code: string } }>(res)).error.code).toBe('dns_failure');
  });

  it('limits to 10 analyses per hour per hashed IP, with Retry-After', async () => {
    const keys: string[] = [];
    const limiter = createMemoryRateLimiter();
    const { post } = setup({
      analyze: okAnalyze,
      rateLimiter: { limit: (key) => (keys.push(key), limiter.limit(key)) },
      env: { RATE_LIMIT_SALT: 'sel' },
    });
    for (let i = 0; i < 10; i += 1)
      expect((await post({ url: 'https://exemple.fr/' })).status).toBe(202);
    const res = await post({ url: 'https://exemple.fr/' });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(3500);
    expect((await body<{ error: { code: string; message: string } }>(res)).error).toMatchObject({
      code: 'rate_limited',
      message: expect.stringContaining('10 analyses par heure'),
    });
    expect(keys.every((k) => /^[0-9a-f]{64}$/.test(k) && !k.includes('203.0.113.9'))).toBe(true);
    expect(
      (await post({ url: 'https://exemple.fr/' }, { 'x-real-ip': '198.51.100.1' })).status,
    ).toBe(202);
    // The end-to-end bucket header is ignored outside the fake-analyzer mode.
    expect(
      (await post({ url: 'https://exemple.fr/' }, { 'x-balise-e2e-client': 'autre' })).status,
    ).toBe(429);
  });

  it('stores analysis errors with their code and French message', async () => {
    const { post, get, settle } = setup({
      analyze: async () => {
        throw new AnalysisError('not_html');
      },
    });
    await post({ url: 'https://exemple.fr/doc.pdf' });
    await settle();
    expect(await body(await get('/api/analyses/analysis1'))).toMatchObject({
      state: 'error',
      error: { code: 'not_html', message: "L'adresse ne renvoie pas une page HTML." },
    });
  });

  it('maps unexpected failures to internal and logs them', async () => {
    const log = vi.fn();
    const { post, get, settle } = setup({
      log,
      analyze: async () => {
        throw new Error('boom');
      },
    });
    await post({ url: 'https://exemple.fr/' });
    await settle();
    expect(await body(await get('/api/analyses/analysis1'))).toMatchObject({
      state: 'error',
      error: { code: 'internal' },
    });
    expect(log).toHaveBeenCalled();
  });

  it('turns the global time limit into an unreachable error', async () => {
    const { post, get, settle } = setup({
      maxAnalysisMs: 20,
      analyze: (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal!.addEventListener('abort', () => reject(new AnalysisAbortedError())),
        ),
    });
    await post({ url: 'https://exemple.fr/' });
    await settle();
    expect(await body(await get('/api/analyses/analysis1'))).toMatchObject({
      state: 'error',
      error: { code: 'unreachable', message: "L'analyse a dépassé la durée maximale autorisée." },
    });
  });
});

describe('DELETE /api/analyses/:id (cancellation)', () => {
  it('marks the analysis cancelled; the worker observes it through polling', async () => {
    let aborted = false;
    const { post, get, settle } = setup({
      cancelPollMs: 10,
      analyze: (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal!.addEventListener('abort', () => {
            aborted = true;
            reject(new AnalysisAbortedError());
          }),
        ),
    });
    await post({ url: 'https://exemple.fr/' });
    await new Promise((r) => setTimeout(r, 5));
    const res = await get('/api/analyses/analysis1', 'DELETE');
    expect(res.status).toBe(202);
    expect(await body(res)).toMatchObject({ state: 'cancelled' });
    await settle();
    expect(aborted).toBe(true);
    expect(await body(await get('/api/analyses/analysis1'))).toMatchObject({ state: 'cancelled' });
  });

  it('is observed between steps and never overwritten by the result', async () => {
    const ref: { handler?: (r: Request) => Promise<Response> } = {};
    const ctx = setup({
      cancelPollMs: 60_000,
      analyze: async (url, options) => {
        await options.onStep?.('loading');
        await ref.handler!(new Request(`${BASE}/api/analyses/${options.id}`, { method: 'DELETE' }));
        await options.onStep?.('testing');
        return okAnalyze(url, options);
      },
    });
    ref.handler = ctx.handler;
    await ctx.post({ url: 'https://exemple.fr/' });
    await ctx.settle();
    const status = await body<AnalysisStatus>(await ctx.get('/api/analyses/analysis1'));
    expect(status.state).toBe('cancelled');
    expect(status.report).toBeUndefined();
    expect((await ctx.get('/api/analyses/analysis1/screenshot')).status).toBe(404);
  });

  it('leaves finished analyses untouched and 404s unknown ones', async () => {
    const { post, get, settle } = setup({ analyze: okAnalyze });
    await post({ url: 'https://exemple.fr/' });
    await settle();
    const res = await get('/api/analyses/analysis1', 'DELETE');
    expect(res.status).toBe(202);
    expect(await body(res)).toMatchObject({ state: 'done' });
    expect((await get('/api/analyses/inconnue123', 'DELETE')).status).toBe(404);
  });
});

describe('routing', () => {
  it('answers 404 not_found and 405 with the French error format', async () => {
    const { get } = setup();
    for (const path of [
      '/api/analyses/inconnue123',
      '/api/analyses/x',
      '/api/analyses/%E0%A4%A',
      '/api/autre',
      '/api/analyses/inconnue123/screenshot',
      '/api/analyses/../x/screenshot',
    ]) {
      const res = await get(path);
      expect(res.status, path).toBe(404);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect((await body<{ error: { code: string; message: string } }>(res)).error.code).toBe(
        'not_found',
      );
    }
    for (const [path, method, allow] of [
      ['/api/analyses', 'GET', 'POST'],
      ['/api/analyses/inconnue123', 'PUT', 'GET, DELETE'],
      ['/api/analyses/inconnue123/screenshot', 'POST', 'GET'],
    ] as const) {
      const res = await get(path, method);
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe(allow);
    }
    const res = await get('/api/analyses/');
    expect(res.status).toBe(405);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('turns unexpected exceptions into 500 internal', async () => {
    const { get } = setup({
      store: {
        get: async () => {
          throw new Error('redis down');
        },
        put: async () => undefined,
        getScreenshot: async () => null,
        putScreenshot: async () => undefined,
      },
    });
    const res = await get('/api/analyses/inconnue123');
    expect(res.status).toBe(500);
    expect((await body<{ error: { code: string } }>(res)).error.code).toBe('internal');
  });
});

describe('configuration', () => {
  it('refuses to run on Vercel without Redis or salt', async () => {
    for (const env of [
      { VERCEL: '1', RATE_LIMIT_SALT: 's' },
      { VERCEL: '1', KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' },
    ]) {
      const handler = createHandlers({ env, log: () => undefined });
      const res = await handler(new Request(`${BASE}/api/analyses/inconnue123`));
      expect(res.status).toBe(500);
    }
  });

  it('falls back to memory locally with the real defaults', async () => {
    const handler = createHandlers({ env: {}, log: () => undefined });
    expect((await handler(new Request(`${BASE}/api/analyses/inconnue123`))).status).toBe(404);
  });
});

describe('fake analyzer (end-to-end mode)', () => {
  it('is enabled only outside production and Vercel', () => {
    expect(isFakeAnalyzerEnabled({ BALISE_E2E_FAKE_ANALYZER: '1' })).toBe(true);
    expect(isFakeAnalyzerEnabled({ BALISE_E2E_FAKE_ANALYZER: '1', NODE_ENV: 'production' })).toBe(
      false,
    );
    expect(isFakeAnalyzerEnabled({ BALISE_E2E_FAKE_ANALYZER: '1', VERCEL: '1' })).toBe(false);
    expect(isFakeAnalyzerEnabled({})).toBe(false);
  });

  it('runs end to end through the handlers, including unreachable pages and e2e buckets', async () => {
    const env = { BALISE_E2E_FAKE_ANALYZER: '1' };
    const { post, get, settle } = setup({ env, analyze: undefined, lookup: undefined });
    expect((await post({ url: 'https://exemple.fr/' })).status).toBe(202);
    expect((await post({ url: 'https://unreachable.exemple/' })).status).toBe(202);
    expect((await post({ url: 'http://192.168.1.1/' })).status).toBe(422);
    await settle();
    const done = await body<AnalysisStatus>(await get('/api/analyses/analysis1'));
    expect(done.state).toBe('done');
    expect(done.report?.criteria).toHaveLength(106);
    expect(done.report?.criteria.some((c) => c.status === 'non-conforme')).toBe(true);
    expect(done.report?.scores.global.score).not.toBeNull();
    expect(
      Buffer.from(await (await get('/api/analyses/analysis1/screenshot')).arrayBuffer()),
    ).toEqual(FAKE_SCREENSHOT);
    expect(await body(await get('/api/analyses/analysis2'))).toMatchObject({
      state: 'error',
      error: { code: 'unreachable' },
    });
    for (let i = 0; i < 8; i += 1) await post({ url: 'https://exemple.fr/' });
    expect((await post({ url: 'https://exemple.fr/' })).status).toBe(429);
    expect(
      (await post({ url: 'https://exemple.fr/' }, { 'x-balise-e2e-client': 'test-1' })).status,
    ).toBe(202);
    await settle();
  });

  it('honours cancellation', async () => {
    await expect(
      fakeAnalyzePage('https://exemple.fr/', { signal: AbortSignal.abort() }),
    ).rejects.toBeInstanceOf(AnalysisAbortedError);
    const controller = new AbortController();
    const p = fakeAnalyzePage('https://exemple.fr/', { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toBeInstanceOf(AnalysisAbortedError);
  });
});
