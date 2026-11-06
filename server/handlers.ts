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
  clientIp,
  createMemoryRateLimiter,
  createUpstashRateLimiter,
  hashClientKey,
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
}

const MAX_BODY_LENGTH = 8 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
/** Public address answered by the fake lookup in end-to-end test mode (never connected to). */
const FAKE_PUBLIC_ADDRESS = '1.1.1.1';

const HTTP_STATUS: Partial<Record<AnalysisErrorCode, number>> = {
  invalid_url: 400,
  forbidden_target: 422,
  dns_failure: 422,
  rate_limited: 429,
  not_found: 404,
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

interface Infrastructure {
  store: AnalysisStore;
  rateLimiter: RateLimiter;
  salt: string;
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
  const redis = credentials ? createRedisClient(credentials) : null;
  return {
    store: deps.store ?? (redis ? createRedisStore(redis) : createMemoryStore()),
    rateLimiter:
      deps.rateLimiter ?? (redis ? createUpstashRateLimiter(redis) : createMemoryRateLimiter()),
    // Local only: a per-process random salt still never exposes the IP.
    salt: salt ?? crypto.randomUUID(),
  };
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
  const { store, rateLimiter, salt } = infra;

  async function runAnalysis(id: string, url: string): Promise<void> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, maxAnalysisMs);
    const poll = setInterval(() => {
      store
        .get(id)
        .then((s) => {
          if (!s || s.state === 'cancelled') controller.abort();
        })
        .catch(() => undefined);
    }, cancelPollMs);

    /** Writes a patch unless the analysis was cancelled meanwhile. */
    const save = async (patch: Partial<AnalysisStatus>): Promise<void> => {
      const latest = await store.get(id);
      if (!latest || latest.state === 'cancelled') {
        controller.abort();
        throw new AnalysisAbortedError();
      }
      // shortcut: read-then-write is not atomic; a DELETE landing between both
      // calls is overwritten. Upgrade to a Lua script / WATCH if it matters.
      await store.put({ ...latest, ...patch, updatedAt: now().toISOString() });
    };

    try {
      await save({ state: 'running', step: 'queued' });
      const { report, screenshot } = await analyze(url, {
        id,
        signal: controller.signal,
        onStep: (step) => save({ step }),
      });
      if (screenshot.length > 0) await store.putScreenshot(id, screenshot);
      await save({
        state: 'done',
        step: 'scoring',
        report: { ...report, hasScreenshot: screenshot.length > 0 },
      });
    } catch (error) {
      if (error instanceof AnalysisAbortedError && !timedOut) return; // cancelled by the user
      const err = timedOut
        ? new AnalysisError('unreachable', "L'analyse a dépassé la durée maximale autorisée.")
        : toAnalysisError(error);
      if (err.code === 'internal') log(`analysis ${id} failed`, error);
      await save({ state: 'error', error: { code: err.code, message: err.message } }).catch(
        () => undefined,
      );
    } finally {
      clearTimeout(timer);
      clearInterval(poll);
    }
  }

  async function create(request: Request): Promise<Response> {
    const text = await request.text();
    let input: unknown;
    try {
      if (text.length > MAX_BODY_LENGTH) throw new Error('too long');
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

    let clientKey = clientIp(request.headers);
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
    waitUntil(runAnalysis(id, url.href));
    return json(
      202,
      { id, url: status.url, state: status.state },
      { location: `/api/analyses/${id}` },
    );
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
    const match = /^\/api\/analyses\/([^/]+)(\/screenshot)?$/.exec(path);
    if (!match) return errorResponse(404, 'not_found', "Cette adresse de l'API n'existe pas.");
    const id = match[1]!; // ids are URL-safe: no decoding needed
    if (match[2]) {
      if (method !== 'GET') return methodNotAllowed('GET');
      return ID_PATTERN.test(id) ? screenshot(id) : notFound();
    }
    if (method !== 'GET' && method !== 'DELETE') return methodNotAllowed('GET, DELETE');
    if (!ID_PATTERN.test(id)) return notFound();
    if (method === 'DELETE') return cancel(id);
    const status = await store.get(id);
    return status ? json(200, status) : notFound();
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
