/**
 * API request handlers (standard Request → Response), independent of Vercel.
 *
 *   POST   /api/analyses                  { url } → 202 { id, url, state }
 *   GET    /api/analyses/:id              → 200 AnalysisStatus
 *   DELETE /api/analyses/:id              → 202 AnalysisStatus (cancellation)
 *   GET    /api/analyses/:id/screenshot   → 200 image/jpeg
 *
 * Errors: { error: { code, message } } with a French message.
 *
 * The analysis itself runs after the 202 response, inside `waitUntil`
 * (Vercel) or as a floating promise (local servers). Cancellation is stored
 * (state "cancelled") and observed by the worker between steps and by polling.
 */
import { createPublicKey, type KeyObject } from 'node:crypto';
import {
  AnalysisAbortedError,
  AnalysisError,
  analyzePage,
  defaultLookup,
  parseAndValidateUrl,
  toAnalysisError,
  validateTarget,
  type AnalysisErrorCode,
  type AnalysisStatus,
  type AnalyzeOptions,
  type AnalyzeResult,
  type LookupAll,
} from '@balise/analyzer';
import { nanoid } from 'nanoid';
import { fakeAnalyzePage, isFakeAnalyzerEnabled } from './fake-analyzer.ts';
import {
  privateKeyFrom,
  REPORT_TOKEN_TTL_MS,
  signReportToken,
  verifyReportToken,
} from './report-token.ts';
import { enrichWithAi } from './ai/judge.ts';
import { runAnalysis, type AnalysisSink } from './run-analysis.ts';
import { parseWorkerResult } from './worker-result.ts';
import {
  clientIp,
  createMemoryRateLimiter,
  createUpstashRateLimiter,
  GLOBAL_RATE_LIMIT_KEY,
  GLOBAL_RATE_LIMIT_MAX,
  hashClientKey,
  rateLimitSubject,
  type RateLimiter,
} from './rate-limit.ts';
import {
  createMemoryStore,
  createRedisClient,
  createRedisStore,
  redisCredentials,
  type AnalysisStore,
} from './store.ts';

export type ApiHandler = (request: Request) => Promise<Response>;
export type AnalyzeFn = (input: string, options: AnalyzeOptions) => Promise<AnalyzeResult>;

export interface HandlerDeps {
  env: NodeJS.ProcessEnv;
  store?: AnalysisStore;
  rateLimiter?: RateLimiter;
  /** Global ceiling shared by every client (key GLOBAL_RATE_LIMIT_KEY). */
  globalRateLimiter?: RateLimiter;
  /** Keeps the function alive after the response (Vercel `waitUntil`). */
  waitUntil?: (promise: Promise<unknown>) => void;
  analyze?: AnalyzeFn;
  /** DNS lookup used for the submission-time check. */
  lookup?: LookupAll;
  now?: () => Date;
  newId?: () => string;
  /** Interval of the cancellation polling of the stored state, ms. */
  cancelPollMs?: number;
  /** Hard limit of one analysis (must stay below the function maxDuration), ms. */
  maxAnalysisMs?: number;
  log?: (message: string, error?: unknown) => void;
  /** Overrides the isolated-worker configuration read from the environment (tests). */
  worker?: { url: string; privateKey: KeyObject; publicKey: KeyObject } | null;
  /** HTTP client used to reach the worker (tests). */
  fetch?: typeof fetch;
  /** HTTP client used to reach Mistral (tests). */
  aiFetch?: typeof fetch;
}

const MAX_BODY_LENGTH = 8 * 1024;
/** Report + base64 screenshot, below the 4.5 MB request limit of Vercel Functions. */
const MAX_REPORT_BODY_LENGTH = 4 * 1024 * 1024;
/**
 * A pending/running analysis not updated for this long has lost its worker
 * (function killed at maxDuration 300 s): it is reported as failed.
 */
export const STALE_ANALYSIS_MS = 300_000;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
/** Public address answered by the fake lookup in end-to-end test mode (never connected to). */
const FAKE_PUBLIC_ADDRESS = '1.1.1.1';

const HTTP_STATUS: Partial<Record<AnalysisErrorCode, number>> = {
  invalid_url: 400,
  forbidden_target: 422,
  dns_failure: 422,
  rate_limited: 429,
  not_found: 404,
  preview_disabled: 503,
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return json(status, { error: { code, message } }, headers);
}

function analysisErrorResponse(error: AnalysisError): Response {
  return errorResponse(HTTP_STATUS[error.code] ?? 500, error.code, error.message);
}

const notFound = (): Response =>
  errorResponse(
    404,
    'not_found',
    "Cette analyse n'existe pas ou a expiré (les rapports sont conservés 30 jours).",
  );

const methodNotAllowed = (allow: string): Response =>
  errorResponse(405, 'method_not_allowed', 'Méthode HTTP non autorisée pour cette adresse.', {
    allow,
  });

const internalError = (): Response =>
  errorResponse(
    500,
    'internal',
    'Une erreur interne est survenue. Réessayez dans quelques instants.',
  );

interface WorkerConfig {
  url: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

interface Infrastructure {
  store: AnalysisStore;
  rateLimiter: RateLimiter;
  globalRateLimiter: RateLimiter;
  salt: string;
  /** Isolated Chromium worker; null = in-process analysis (local and tests only). */
  worker: WorkerConfig | null;
}

/**
 * BALISE_WORKER_URL + BALISE_TOKEN_PRIVATE_KEY select the isolated mode. It is
 * mandatory on Vercel: Chromium must never run next to the Redis credentials.
 */
function workerConfig(env: NodeJS.ProcessEnv): WorkerConfig | null | string {
  const url = env.BALISE_WORKER_URL;
  const key = env.BALISE_TOKEN_PRIVATE_KEY;
  if (!url || !key) {
    return env.VERCEL ? 'BALISE_WORKER_URL / BALISE_TOKEN_PRIVATE_KEY manquants.' : null;
  }
  if (!url.startsWith('https://') && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    return 'BALISE_WORKER_URL doit être en https.';
  }
  try {
    const privateKey = privateKeyFrom(key);
    return { url, privateKey, publicKey: createPublicKey(privateKey) };
  } catch {
    return 'BALISE_TOKEN_PRIVATE_KEY invalide (DER PKCS#8 Ed25519 en base64 attendu).';
  }
}

/**
 * Production wiring: Upstash when credentials are present; in-memory otherwise,
 * which is refused on Vercel (functions do not share memory).
 */
function defaultInfrastructure(deps: HandlerDeps): Infrastructure | string {
  const { env } = deps;
  const credentials = redisCredentials(env);
  if (!credentials && env.VERCEL && (!deps.store || !deps.rateLimiter)) {
    return 'KV_REST_API_URL / KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL / _TOKEN) manquants.';
  }
  const salt = env.RATE_LIMIT_SALT;
  if (!salt && env.VERCEL) return 'RATE_LIMIT_SALT manquant.';
  const worker = deps.worker !== undefined ? deps.worker : workerConfig(env);
  if (typeof worker === 'string') return worker;
  const redis = credentials ? createRedisClient(credentials) : null;
  return {
    worker,
    store: deps.store ?? (redis ? createRedisStore(redis) : createMemoryStore()),
    rateLimiter:
      deps.rateLimiter ?? (redis ? createUpstashRateLimiter(redis) : createMemoryRateLimiter()),
    globalRateLimiter:
      deps.globalRateLimiter ??
      (redis
        ? createUpstashRateLimiter(redis, GLOBAL_RATE_LIMIT_MAX, 'balise:ratelimit:global')
        : createMemoryRateLimiter(GLOBAL_RATE_LIMIT_MAX)),
    // Local only: a per-process random salt still never exposes the IP.
    salt: salt ?? crypto.randomUUID(),
  };
}

/** Reads the body as text, or null beyond `max` bytes (declared or streamed). */
async function readBodyCapped(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > max) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createHandlers(deps: HandlerDeps): ApiHandler {
  const log =
    deps.log ??
    ((message: string, error?: unknown) => console.error(`[balise] ${message}`, error ?? ''));
  const fake = isFakeAnalyzerEnabled(deps.env);
  const analyze: AnalyzeFn = deps.analyze ?? (fake ? fakeAnalyzePage : analyzePage);
  const lookup: LookupAll =
    deps.lookup ??
    (fake ? async () => [{ address: FAKE_PUBLIC_ADDRESS, family: 4 }] : defaultLookup);
  const waitUntil =
    deps.waitUntil ??
    ((promise: Promise<unknown>) => {
      promise.catch((error: unknown) => log('analysis worker crashed', error));
    });
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => nanoid());
  const cancelPollMs = deps.cancelPollMs ?? 2000;
  const maxAnalysisMs = deps.maxAnalysisMs ?? 240_000;

  const infra = defaultInfrastructure(deps);
  if (typeof infra === 'string') {
    log(`configuration incomplète : ${infra}`);
    return async () => internalError();
  }
  const { store, rateLimiter, globalRateLimiter, salt, worker } = infra;
  const fetchImpl = deps.fetch ?? fetch;

  /** Writes a patch unless the analysis was cancelled or is gone. */
  async function patchActive(id: string, patch: Partial<AnalysisStatus>): Promise<boolean> {
    const latest = await store.get(id);
    if (!latest || latest.state === 'cancelled') return false;
    // shortcut: read-then-write is not atomic; a DELETE landing between both
    // calls is overwritten. Upgrade to a Lua script / WATCH if it matters.
    await store.put({ ...latest, ...patch, updatedAt: now().toISOString() });
    return true;
  }

  /** Local / test mode: Chromium runs in this process and writes to the store directly. */
  const storeSink = (id: string): AnalysisSink => ({
    cancelled: async () => {
      const s = await store.get(id);
      return !s || s.state === 'cancelled';
    },
    step: async (step) => {
      if (!(await patchActive(id, { state: 'running', step }))) throw new AnalysisAbortedError();
    },
    done: async (report, screenshot, pack) => {
      // The only place that holds MISTRAL_API_KEY (never the Chromium worker).
      const judged = await enrichWithAi(report, pack, deps.env, { fetch: deps.aiFetch, log });
      if (screenshot.length > 0) await store.putScreenshot(id, screenshot);
      if (!(await patchActive(id, { state: 'done', step: 'scoring', report: judged }))) {
        throw new AnalysisAbortedError();
      }
    },
    failed: async (error) => {
      await patchActive(id, {
        state: 'error',
        error: { code: error.code as AnalysisErrorCode, message: error.message },
      });
    },
  });

  /**
   * Isolated mode (production): hands the analysis to the Chromium worker,
   * which has no Redis access, with a single-use token for the report.
   */
  async function dispatch(id: string, url: string, worker: WorkerConfig): Promise<void> {
    const nonce = crypto.randomUUID();
    await store.putToken(id, nonce, Math.ceil(REPORT_TOKEN_TTL_MS / 1000));
    const token = signReportToken(worker.privateKey, {
      id,
      url,
      nonce,
      exp: now().getTime() + REPORT_TOKEN_TTL_MS,
    });
    try {
      const res = await fetchImpl(worker.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, url, token }),
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status !== 202) throw new Error(`worker answered ${res.status}`);
      await patchActive(id, { state: 'running', step: 'queued' });
    } catch (error) {
      log(`analysis ${id}: worker dispatch failed`, error);
      await patchActive(id, {
        state: 'error',
        error: {
          code: 'internal',
          message: "L'analyseur n'a pas pu démarrer. Réessayez dans quelques instants.",
        },
      });
    }
  }

  /** POST /api/analyses/:id/report — the only write path of the isolated worker. */
  async function receiveReport(request: Request, id: string, worker: WorkerConfig) {
    const auth = request.headers.get('authorization') ?? '';
    const payload = auth.startsWith('Bearer ')
      ? verifyReportToken(worker.publicKey, auth.slice(7), now().getTime())
      : null;
    const unauthorized = () =>
      errorResponse(401, 'unauthorized', 'Jeton de rapport invalide, expiré ou déjà utilisé.');
    if (!payload || payload.id !== id) return unauthorized();
    // Single use, consumed before anything else is read.
    if (!(await store.consumeToken(id, payload.nonce))) return unauthorized();
    const text = await readBodyCapped(request, MAX_REPORT_BODY_LENGTH);
    const parsed = text === null ? null : parseWorkerResult(text, id);
    if (!parsed) return errorResponse(400, 'invalid_report', 'Rapport mal formé.');
    const sink = storeSink(id);
    try {
      if ('report' in parsed) await sink.done(parsed.report, parsed.screenshot, parsed.pack);
      else await sink.failed(parsed.error);
    } catch (error) {
      if (error instanceof AnalysisAbortedError) {
        return errorResponse(409, 'cancelled', 'Cette analyse a été annulée.');
      }
      throw error;
    }
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }

  async function create(request: Request): Promise<Response> {
    // The worker only reports to the production API (BALISE_API_ORIGIN), and
    // previews sit behind Vercel deployment protection: no analysis there.
    if (deps.env.VERCEL_ENV === 'preview') {
      return errorResponse(
        503,
        'preview_disabled',
        'L’analyse est désactivée sur les déploiements de préversion. Utilisez https://balise-tau.vercel.app.',
      );
    }
    // Browsers always send Sec-Fetch-Site: refuse submissions from other sites.
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return errorResponse(
        403,
        'forbidden_origin',
        'Les analyses ne peuvent être demandées que depuis le site de Balise.',
      );
    }
    const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (type !== 'application/json') {
      return errorResponse(
        415,
        'unsupported_media_type',
        'Le corps de la requête doit être envoyé en JSON (Content-Type: application/json).',
      );
    }
    const text = await readBodyCapped(request, MAX_BODY_LENGTH);
    let input: unknown;
    try {
      if (text === null) throw new Error('too long');
      input = (JSON.parse(text) as { url?: unknown } | null)?.url;
    } catch {
      input = undefined;
    }
    if (typeof input !== 'string') {
      return errorResponse(
        400,
        'invalid_url',
        'Le corps de la requête doit être un objet JSON { "url": "…" }.',
      );
    }
    try {
      parseAndValidateUrl(input);
    } catch (error) {
      return analysisErrorResponse(toAnalysisError(error));
    }

    let clientKey = rateLimitSubject(clientIp(request.headers));
    // End-to-end test mode only: lets each test use its own rate-limit bucket.
    const e2eClient = fake ? request.headers.get('x-balise-e2e-client') : null;
    if (e2eClient) clientKey += `|${e2eClient}`;
    const { success, reset } = await rateLimiter.limit(hashClientKey(clientKey, salt));
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - now().getTime()) / 1000));
      return errorResponse(
        429,
        'rate_limited',
        'Vous avez atteint la limite de 10 analyses par heure. Réessayez plus tard.',
        { 'retry-after': String(retryAfter) },
      );
    }
    // Checked after the per-client limit so that a blocked client does not
    // consume the global budget. Not applied in end-to-end test mode.
    const global = fake ? null : await globalRateLimiter.limit(GLOBAL_RATE_LIMIT_KEY);
    if (global && !global.success) {
      const retryAfter = Math.max(1, Math.ceil((global.reset - now().getTime()) / 1000));
      return errorResponse(
        429,
        'rate_limited',
        'Balise a atteint son nombre maximal d’analyses pour cette heure. Réessayez plus tard.',
        { 'retry-after': String(retryAfter) },
      );
    }

    let url: URL;
    try {
      url = (await validateTarget(input, lookup)).url;
    } catch (error) {
      return analysisErrorResponse(toAnalysisError(error));
    }

    const id = newId();
    const at = now().toISOString();
    const status: AnalysisStatus = {
      id,
      url: url.href,
      state: 'pending',
      step: 'validated',
      createdAt: at,
      updatedAt: at,
    };
    await store.put(status);
    waitUntil(
      worker
        ? dispatch(id, url.href, worker)
        : runAnalysis(id, url.href, storeSink(id), { analyze, cancelPollMs, maxAnalysisMs, log }),
    );
    return json(
      202,
      { id, url: status.url, state: status.state },
      { location: `/api/analyses/${id}` },
    );
  }

  /** Reports (and stores) an analysis whose worker disappeared as failed. */
  async function expireStale(status: AnalysisStatus): Promise<AnalysisStatus> {
    const active = status.state === 'pending' || status.state === 'running';
    const age = now().getTime() - Date.parse(status.updatedAt);
    if (!active || !(age > STALE_ANALYSIS_MS)) return status;
    const failed: AnalysisStatus = {
      ...status,
      state: 'error',
      error: {
        code: 'internal',
        message: "L'analyse s'est interrompue avant la fin (durée maximale dépassée). Relancez-la.",
      },
      updatedAt: now().toISOString(),
    };
    await store.put(failed).catch((error: unknown) => log('stale analysis update failed', error));
    return failed;
  }

  async function cancel(id: string): Promise<Response> {
    const status = await store.get(id);
    if (!status) return notFound();
    if (status.state === 'pending' || status.state === 'running') {
      const cancelled: AnalysisStatus = {
        ...status,
        state: 'cancelled',
        updatedAt: now().toISOString(),
      };
      await store.put(cancelled);
      return json(202, cancelled);
    }
    return json(202, status);
  }

  async function screenshot(id: string): Promise<Response> {
    const jpeg = await store.getScreenshot(id);
    if (!jpeg) return notFound();
    return new Response(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'private, max-age=86400',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  async function route(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    const method = request.method.toUpperCase();
    if (path === '/api/analyses') {
      return method === 'POST' ? create(request) : methodNotAllowed('POST');
    }
    const match = /^\/api\/analyses\/([^/]+)(\/screenshot|\/report)?$/.exec(path);
    if (!match) return errorResponse(404, 'not_found', "Cette adresse de l'API n'existe pas.");
    const id = match[1]!; // ids are URL-safe: no decoding needed
    if (match[2] === '/report') {
      if (!worker) return errorResponse(404, 'not_found', "Cette adresse de l'API n'existe pas.");
      if (method !== 'POST') return methodNotAllowed('POST');
      return ID_PATTERN.test(id) ? receiveReport(request, id, worker) : notFound();
    }
    if (match[2]) {
      if (method !== 'GET') return methodNotAllowed('GET');
      return ID_PATTERN.test(id) ? screenshot(id) : notFound();
    }
    if (method !== 'GET' && method !== 'DELETE') return methodNotAllowed('GET, DELETE');
    if (!ID_PATTERN.test(id)) return notFound();
    if (method === 'DELETE') return cancel(id);
    const status = await store.get(id);
    if (!status) return notFound();
    return json(200, await expireStale(status));
  }

  return async (request) => {
    try {
      return await route(request);
    } catch (error) {
      log('request failed', error);
      return internalError();
    }
  };
}
