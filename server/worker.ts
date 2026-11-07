/**
 * Isolated Chromium worker (separate Vercel project, see worker/).
 *
 *   POST /api/run { id, url, token } → 202, then runs the analysis.
 *
 * It holds NO storage credential: it refuses to start if any Redis/Upstash
 * variable, the rate-limit salt or the token private key is present. It only
 * knows the public key (to check that the API really asked for this
 * analysis) and the public origin of the API, to which it returns the report
 * with the single-use token (POST /api/analyses/:id/report). Cancellation is
 * read from the public status endpoint.
 */
import { analyzePage, type AnalysisReport } from '@balise/analyzer';
import type { KeyObject } from 'node:crypto';
import type { AnalyzeFn, ApiHandler } from './handlers.ts';
import { errorResponse } from './handlers.ts';
import { publicKeyFrom, verifyReportToken } from './report-token.ts';
import { runAnalysis, type AnalysisSink } from './run-analysis.ts';

/** Variables that must never reach the function running Chromium. */
export const FORBIDDEN_WORKER_ENV =
  /^(KV_|UPSTASH_|REDIS_|MISTRAL_)|^(RATE_LIMIT_SALT|BALISE_TOKEN_PRIVATE_KEY)$/;

export interface WorkerDeps {
  env: NodeJS.ProcessEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
  analyze?: AnalyzeFn;
  fetch?: typeof fetch;
  now?: () => Date;
  cancelPollMs?: number;
  maxAnalysisMs?: number;
  log?: (message: string, error?: unknown) => void;
}

/** Returns an error message when the environment is not safe/complete. */
export function workerEnvProblem(env: NodeJS.ProcessEnv): string | null {
  const leaked = Object.keys(env).filter((k) => FORBIDDEN_WORKER_ENV.test(k));
  if (leaked.length) return `variables interdites présentes : ${leaked.join(', ')}`;
  if (!env.BALISE_TOKEN_PUBLIC_KEY || !env.BALISE_API_ORIGIN) {
    return 'BALISE_TOKEN_PUBLIC_KEY / BALISE_API_ORIGIN manquants.';
  }
  if (!/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(env.BALISE_API_ORIGIN)) {
    return 'BALISE_API_ORIGIN doit être en https.';
  }
  return null;
}

export function createWorkerHandler(deps: WorkerDeps): ApiHandler {
  const log =
    deps.log ??
    ((message: string, error?: unknown) =>
      console.error(`[balise-worker] ${message}`, error ?? ''));
  const problem = workerEnvProblem(deps.env);
  let publicKey: KeyObject | null;
  try {
    publicKey = problem ? null : publicKeyFrom(deps.env.BALISE_TOKEN_PUBLIC_KEY!);
  } catch {
    publicKey = null;
  }
  if (!publicKey) {
    log(`configuration refusée : ${problem ?? 'BALISE_TOKEN_PUBLIC_KEY invalide.'}`);
    return async () =>
      errorResponse(500, 'internal', 'Une erreur interne est survenue. Réessayez plus tard.');
  }
  const key = publicKey;
  const origin = deps.env.BALISE_API_ORIGIN!.replace(/\/+$/, '');
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const analyze = deps.analyze ?? analyzePage;
  const waitUntil =
    deps.waitUntil ??
    ((promise: Promise<unknown>) => void promise.catch((e: unknown) => log('worker crashed', e)));

  const httpSink = (id: string, token: string): AnalysisSink => {
    const statusUrl = `${origin}/api/analyses/${id}`;
    const send = async (body: unknown): Promise<void> => {
      const res = await fetchImpl(`${statusUrl}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        redirect: 'error',
      });
      if (res.status !== 204 && res.status !== 409) log(`report ${id} refused: ${res.status}`);
    };
    return {
      cancelled: async () => {
        const res = await fetchImpl(statusUrl, { redirect: 'error' });
        if (res.status === 404) return true;
        const s = (await res.json()) as { state?: unknown };
        return s.state === 'cancelled';
      },
      // Progress is not reported: the worker cannot write, and the token is single-use.
      step: async () => undefined,
      done: (report: AnalysisReport, screenshot: Buffer, pack) =>
        send({ report, screenshot: screenshot.toString('base64'), pack }),
      failed: (error) => send({ error }),
    };
  };

  return async (request) => {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (path !== '/api/run') return errorResponse(404, 'not_found', "Cette adresse n'existe pas.");
    if (request.method !== 'POST') {
      return errorResponse(405, 'method_not_allowed', 'Méthode HTTP non autorisée.', {
        allow: 'POST',
      });
    }
    let body: { id?: unknown; url?: unknown; token?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }
    const { id, url, token } = body;
    const payload =
      typeof token === 'string' ? verifyReportToken(key, token, now().getTime()) : null;
    if (!payload || payload.id !== id || payload.url !== url || typeof token !== 'string') {
      return errorResponse(401, 'unauthorized', 'Jeton invalide ou expiré.');
    }
    waitUntil(
      runAnalysis(payload.id, payload.url, httpSink(payload.id, token), {
        analyze,
        cancelPollMs: deps.cancelPollMs ?? 2000,
        maxAnalysisMs: deps.maxAnalysisMs ?? 240_000,
        log,
      }),
    );
    return new Response(null, { status: 202 });
  };
}
