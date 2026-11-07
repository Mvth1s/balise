import type { AnalysisReport, LookupAll } from '@balise/analyzer';
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createHandlers, type AnalyzeFn } from './handlers.ts';
import { createMemoryRateLimiter } from './rate-limit.ts';
import { signReportToken, verifyReportToken } from './report-token.ts';
import { createMemoryStore } from './store.ts';
import { createWorkerHandler, workerEnvProblem } from './worker.ts';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const PUBLIC_B64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const API = 'https://api.test';
const WORKER = 'https://worker.test/api/run';
const lookup: LookupAll = async () => [{ address: '93.184.215.14', family: 4 }];
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

const analyze: AnalyzeFn = async (url, options) => ({
  report: {
    schemaVersion: 1,
    id: options.id!,
    url,
    criteria: [],
    scores: { global: null, themes: [] },
  } as unknown as AnalysisReport,
  screenshot: JPEG,
});

/** API and worker wired together through an in-memory fetch. */
function wire(workerEnv: NodeJS.ProcessEnv = {}) {
  const store = createMemoryStore();
  const jobs: Promise<unknown>[] = [];
  const waitUntil = (p: Promise<unknown>) => void jobs.push(p);
  const calls: string[] = [];
  const route: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push(`${request.method} ${request.url}`);
    return request.url.startsWith(WORKER) ? worker(request) : api(request);
  };
  const api = createHandlers({
    env: {},
    store,
    rateLimiter: createMemoryRateLimiter(),
    lookup,
    waitUntil,
    fetch: route,
    worker: { url: WORKER, privateKey, publicKey },
    log: () => undefined,
  });
  const worker = createWorkerHandler({
    env: { BALISE_TOKEN_PUBLIC_KEY: PUBLIC_B64, BALISE_API_ORIGIN: API, ...workerEnv },
    analyze,
    fetch: route,
    waitUntil,
    log: () => undefined,
  });
  const settle = async () => {
    for (let i = 0; i < jobs.length; i += 1) await jobs[i];
  };
  return { store, api, worker, calls, settle };
}

describe('isolated Chromium worker', () => {
  it('runs the analysis in the worker and stores the report through the writer', async () => {
    const { api, store, calls, settle } = wire();
    const res = await api(
      new Request(`${API}/api/analyses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.exemple.fr/' }),
      }),
    );
    const { id } = (await res.json()) as { id: string };
    await settle();
    const status = await store.get(id);
    expect(status?.state).toBe('done');
    expect(status?.report?.hasScreenshot).toBe(true);
    expect(await store.getScreenshot(id)).toEqual(JPEG);
    expect(calls).toEqual([`POST ${WORKER}`, `POST ${API}/api/analyses/${id}/report`]);
  });

  it('accepts a report token once, and refuses forged or expired ones', async () => {
    const { api, store } = wire();
    const at = new Date().toISOString();
    await store.put({
      id: 'abcdefgh',
      url: 'https://x.fr/',
      state: 'running',
      createdAt: at,
      updatedAt: at,
    });
    await store.putToken('abcdefgh', 'n1', 60);
    const send = (token: string) =>
      api(
        new Request(`${API}/api/analyses/abcdefgh/report`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({ error: { code: 'unreachable', message: 'Page injoignable.' } }),
        }),
      );
    const exp = Date.now() + 60_000;
    const forged = generateKeyPairSync('ed25519').privateKey;
    expect(
      (await send(signReportToken(forged, { id: 'abcdefgh', url: 'u', nonce: 'n1', exp }))).status,
    ).toBe(401);
    expect(
      (await send(signReportToken(privateKey, { id: 'abcdefgh', url: 'u', nonce: 'n1', exp: 1 })))
        .status,
    ).toBe(401);
    const token = signReportToken(privateKey, { id: 'abcdefgh', url: 'u', nonce: 'n1', exp });
    expect((await send(token)).status).toBe(204);
    expect((await store.get('abcdefgh'))?.state).toBe('error');
    expect((await send(token)).status).toBe(401); // single use
  });

  it('refuses to start next to storage credentials, and without a valid token', async () => {
    expect(workerEnvProblem({ KV_REST_API_TOKEN: 'x' })).toMatch(/KV_REST_API_TOKEN/);
    expect(workerEnvProblem({ UPSTASH_REDIS_REST_URL: 'x' })).toMatch(/UPSTASH/);
    expect(workerEnvProblem({ BALISE_TOKEN_PRIVATE_KEY: 'x' })).toMatch(/PRIVATE/);
    const { worker } = wire({ KV_REST_API_URL: 'https://redis' });
    const run = (body: unknown) =>
      worker(new Request(WORKER, { method: 'POST', body: JSON.stringify(body) }));
    expect((await run({})).status).toBe(500);

    const ok = wire().worker;
    const token = signReportToken(privateKey, {
      id: 'abcdefgh',
      url: 'https://x.fr/',
      nonce: 'n',
      exp: Date.now() + 1000,
    });
    const post = (body: unknown) =>
      ok(new Request(WORKER, { method: 'POST', body: JSON.stringify(body) }));
    // Token bound to the id and URL.
    expect((await post({ id: 'abcdefgh', url: 'https://autre.fr/', token })).status).toBe(401);
    expect((await post({ id: 'abcdefgh', url: 'https://x.fr/', token: 'x.y' })).status).toBe(401);
    expect(verifyReportToken(publicKey, token, Date.now())?.id).toBe('abcdefgh');
  });
});
