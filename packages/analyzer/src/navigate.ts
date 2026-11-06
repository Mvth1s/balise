/**
 * Page loading under full request interception.
 *
 * Every request issued by the browser context (main document, sub-resources,
 * frames, redirects, popups) is intercepted, re-validated and executed by
 * `safeFetch` in Node; the response is handed back with `route.fulfill`.
 *
 * A 3xx is NEVER handed to the browser: Chromium follows a fulfilled redirect
 * without re-intercepting the next hop, which would bypass the SSRF checks
 * (the dead proxy then catches it). Instead:
 * - main document: an empty page is served, the target recorded, and `navigate`
 *   issues a new `page.goto` for it (intercepted and re-validated in turn), so
 *   that `page.url()` and the base URL of the page stay correct;
 * - other requests: redirects are followed in Node, each hop going through
 *   `safeFetch` (scheme, port, DNS and address checks).
 * WebSockets are refused.
 */
import type { BrowserContext, Page, Route } from 'playwright-core';
import { AnalysisAbortedError, AnalysisError } from './errors.js';
import {
  createAgents,
  DEFAULT_MAX_RESOURCE_BYTES,
  safeFetch,
  type SafeFetchOptions,
  type SafeFetchRequest,
  type SafeFetchResponse,
} from './safe-fetch.js';
import type { LookupAll } from './url-guard.js';

export interface NavigationLimits {
  /** Total loading budget (navigation + stabilisation), ms. */
  loadTimeoutMs: number;
  maxRequests: number;
  maxTotalBytes: number;
  maxResourceBytes: number;
  /** Quiet period without network activity, ms. */
  networkIdleMs: number;
  /** Upper bound of the network-quiet wait, ms. */
  networkIdleMaxMs: number;
  /** Per-request timeout, ms. */
  requestTimeoutMs: number;
}

export const DEFAULT_LIMITS: NavigationLimits = {
  loadTimeoutMs: 60_000,
  maxRequests: 300,
  maxTotalBytes: 15 * 1024 * 1024,
  maxResourceBytes: DEFAULT_MAX_RESOURCE_BYTES,
  networkIdleMs: 500,
  networkIdleMaxMs: 10_000,
  requestTimeoutMs: 20_000,
};

export type FetchFn = (
  req: SafeFetchRequest,
  options: SafeFetchOptions,
) => Promise<SafeFetchResponse>;

export interface NavigateOptions {
  lookup?: LookupAll;
  allowPrivateHosts?: boolean;
  signal?: AbortSignal;
  limits?: Partial<NavigationLimits>;
  /** Injected for tests; defaults to safeFetch. */
  fetch?: FetchFn;
}

export interface NavigationStats {
  requests: number;
  bytes: number;
  blocked: number;
}

export interface NavigationResult {
  finalUrl: string;
  status: number;
  screenshot: Buffer;
  stats: NavigationStats;
}

/** Maximum number of redirects followed for one request (main document included). */
export const MAX_REDIRECTS = 10;

const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

export function isHtmlContentType(value: string | undefined): boolean {
  if (!value) return false;
  const mime = value.split(';')[0]!.trim().toLowerCase();
  return HTML_TYPES.includes(mime);
}

/**
 * Target of a redirect response, or null when `status`/`location` do not
 * describe one. Throws `forbidden_target` for a non-http(s) target (file:,
 * data:, javascript:... are never intercepted by Playwright).
 */
export function redirectTarget(
  status: number,
  headers: Record<string, string>,
  base: string,
): URL | null {
  const location = headers['location'];
  if (status < 300 || status >= 400 || !location) return null;
  let target: URL;
  try {
    target = new URL(location, base);
  } catch {
    throw new AnalysisError('unreachable', 'La page a renvoyé une redirection invalide.');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new AnalysisError(
      'forbidden_target',
      'La page redirige vers une adresse qui n’est ni en http ni en https.',
    );
  }
  target.hash = '';
  return target;
}

function tooManyRedirects(): AnalysisError {
  return new AnalysisError('unreachable', 'La page effectue trop de redirections.');
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function safeAbort(route: Route): Promise<void> {
  try {
    await route.abort('blockedbyclient');
  } catch {
    // page or context already closed
  }
}

/**
 * Installs interception on the context and returns the shared state.
 * Exported for tests.
 */
export async function installInterception(
  context: BrowserContext,
  page: Page,
  options: NavigateOptions,
  limits: NavigationLimits,
): Promise<{
  state: {
    requests: number;
    bytes: number;
    blocked: number;
    inflight: number;
    lastActivity: number;
    mainError: AnalysisError | null;
    mainStatus: number;
    /** Redirect target of the main document, followed by `navigate`. */
    mainRedirect: URL | null;
    stopped: boolean;
  };
  dispose: () => void;
}> {
  const fetchFn: FetchFn = options.fetch ?? safeFetch;
  const agents = createAgents();
  const state = {
    requests: 0,
    bytes: 0,
    blocked: 0,
    inflight: 0,
    lastActivity: Date.now(),
    mainError: null as AnalysisError | null,
    mainStatus: 0,
    mainRedirect: null as URL | null,
    stopped: false,
  };

  const isMainDocument = (route: Route): boolean => {
    const request = route.request();
    try {
      return request.isNavigationRequest() && request.frame() === page.mainFrame();
    } catch {
      return false;
    }
  };

  await context.routeWebSocket(/.*/, async (ws) => {
    state.blocked += 1;
    await ws.close({ code: 1008, reason: 'WebSocket non autorisé' }).catch(() => undefined);
  });

  await context.route('**/*', async (route) => {
    const request = route.request();
    const main = isMainDocument(route);
    const block = async (error?: AnalysisError): Promise<void> => {
      state.blocked += 1;
      if (main && error && !state.mainError) state.mainError = error;
      await safeAbort(route);
    };

    if (state.stopped) return block();
    let target: URL;
    try {
      target = new URL(request.url());
    } catch {
      return block(new AnalysisError('invalid_url'));
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return block(new AnalysisError('forbidden_target'));
    }
    let current: SafeFetchRequest = {
      url: target.href,
      method: request.method(),
      headers: await request.allHeaders(),
      body: request.postDataBuffer(),
    };
    state.inflight += 1;
    state.lastActivity = Date.now();
    try {
      for (let hop = 0; ; hop += 1) {
        if (state.stopped) return await block();
        if (state.requests >= limits.maxRequests)
          return await block(new AnalysisError('too_large'));
        const remaining = limits.maxTotalBytes - state.bytes;
        if (remaining <= 0) return await block(new AnalysisError('too_large'));
        state.requests += 1;
        const response = await fetchFn(current, {
          lookup: options.lookup,
          allowPrivateHosts: options.allowPrivateHosts,
          maxBytes: Math.min(limits.maxResourceBytes, remaining),
          timeoutMs: limits.requestTimeoutMs,
          signal: options.signal,
          agents,
        });
        state.bytes += response.body.length;
        state.lastActivity = Date.now();
        const next = redirectTarget(response.status, response.headers, current.url);
        if (next) {
          if (hop >= MAX_REDIRECTS) return await block(tooManyRedirects());
          if (main) {
            state.mainRedirect = next;
            // An empty page rather than an abort: an aborted navigation commits
            // an error page that would race with the next `goto`.
            return await route.fulfill({ status: 200, contentType: 'text/html', body: '' });
          }
          // 303, and 301/302 on POST, become GET without body (fetch semantics).
          const toGet =
            response.status === 303 ||
            ((response.status === 301 || response.status === 302) && current.method === 'POST');
          current = {
            url: next.href,
            method: toGet ? 'GET' : current.method,
            headers: current.headers,
            body: toGet ? null : current.body,
          };
          continue;
        }
        if (main) {
          state.mainStatus = response.status;
          if (response.status >= 400) {
            return await block(
              new AnalysisError(
                'unreachable',
                `La page a répondu avec le statut HTTP ${response.status}.`,
              ),
            );
          }
          if (!isHtmlContentType(response.headers['content-type'])) {
            return await block(new AnalysisError('not_html'));
          }
        }
        return await route.fulfill({
          status: response.status,
          headers: response.headers,
          body: response.body,
        });
      }
    } catch (error) {
      const err =
        error instanceof AnalysisError
          ? error
          : new AnalysisError('unreachable', undefined, { cause: error });
      await block(err);
    } finally {
      state.inflight -= 1;
      state.lastActivity = Date.now();
    }
  });

  return {
    state,
    dispose: () => {
      state.stopped = true;
      agents.destroy();
    },
  };
}

/**
 * Loads `url` in `page` (whose context gets full interception), waits for
 * stabilisation and takes a viewport JPEG screenshot.
 */
export async function navigate(
  page: Page,
  url: string,
  options: NavigateOptions = {},
): Promise<NavigationResult> {
  const limits: NavigationLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const context = page.context();
  const started = Date.now();
  const deadline = started + limits.loadTimeoutMs;
  const { state, dispose } = await installInterception(context, page, options, limits);

  const onAbort = (): void => {
    state.stopped = true;
    void page.close().catch(() => undefined);
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    let target = url;
    for (let hop = 0; ; hop += 1) {
      if (options.signal?.aborted) throw new AnalysisAbortedError();
      if (hop > MAX_REDIRECTS) throw tooManyRedirects();
      // `file:`, `data:`... are not intercepted: only http(s) may reach goto.
      const protocol = new URL(target).protocol;
      if (protocol !== 'http:' && protocol !== 'https:')
        throw new AnalysisError('forbidden_target');
      state.mainRedirect = null;
      try {
        await page.goto(target, { waitUntil: 'load', timeout: Math.max(1, deadline - Date.now()) });
      } catch (error) {
        if (options.signal?.aborted) throw new AnalysisAbortedError();
        if (state.mainError) throw state.mainError;
        if (state.mainRedirect) {
          target = (state.mainRedirect as URL).href;
          continue;
        }
        const timeout = error instanceof Error && error.name === 'TimeoutError';
        throw new AnalysisError(
          'unreachable',
          timeout
            ? 'La page ne s’est pas chargée dans le délai de 60 secondes.'
            : 'La page n’a pas pu être chargée.',
          { cause: error },
        );
      }
      if (state.mainError) throw state.mainError;

      // Network quiet: `networkIdleMs` without activity, bounded.
      const idleDeadline = Math.min(deadline, Date.now() + limits.networkIdleMaxMs);
      while (Date.now() < idleDeadline && !state.mainRedirect) {
        if (options.signal?.aborted) throw new AnalysisAbortedError();
        if (state.inflight === 0 && Date.now() - state.lastActivity >= limits.networkIdleMs) break;
        await sleep(50);
      }
      if (options.signal?.aborted) throw new AnalysisAbortedError();
      // A script-initiated navigation that redirected: follow it as well.
      if (state.mainRedirect && Date.now() < deadline) {
        target = (state.mainRedirect as URL).href;
        continue;
      }
      break;
    }

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 60,
      fullPage: false,
      timeout: 15_000,
    });
    return {
      finalUrl: page.url(),
      status: state.mainStatus,
      screenshot,
      stats: { requests: state.requests, bytes: state.bytes, blocked: state.blocked },
    };
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    // Loading phase over: interception stays installed and now refuses every
    // further request (the page is frozen for testing); sockets are closed.
    dispose();
  }
}
