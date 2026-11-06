/**
 * Server-side HTTP(S) client used for EVERY request of the analysed page.
 *
 * Anti DNS rebinding: the host name is resolved exactly once per connection,
 * inside the socket `lookup` hook. The addresses are checked there and the
 * socket connects to the very addresses that were checked: there is no second
 * resolution an attacker could answer differently.
 */
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import zlib from 'node:zlib';
import type { Readable } from 'node:stream';
import { AnalysisError } from './errors.js';
import {
  ALLOWED_PORTS,
  defaultLookup,
  normalizeHost,
  resolveAndCheck,
  type LookupAll,
} from './url-guard.js';

export const DEFAULT_MAX_RESOURCE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_FETCH_TIMEOUT_MS = 20_000;

export interface SafeFetchRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Buffer | null;
}

export interface SafeFetchOptions {
  lookup?: LookupAll;
  /** Tests and demo build only: allows private addresses and any port. */
  allowPrivateHosts?: boolean;
  timeoutMs?: number;
  /** Maximum size of the (decompressed) body. */
  maxBytes?: number;
  /**
   * Shared byte budget (several requests of one page): decremented as chunks
   * arrive, `too_large` once exhausted.
   */
  budget?: { remaining: number };
  signal?: AbortSignal;
  /** Optional keep-alive agents shared by one analysis. */
  agents?: { http: http.Agent; https: https.Agent };
}

export interface SafeFetchResponse {
  url: string;
  status: number;
  /** Lower-case header names; multiple values joined by "\n" (set-cookie) or ", ". */
  headers: Record<string, string>;
  body: Buffer;
  /** Address the socket actually connected to. */
  remoteAddress?: string;
}

/** Request headers never forwarded from the browser. */
const DROPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-connection',
  'proxy-authorization',
  'transfer-encoding',
  'content-length',
  'te',
  'trailer',
  'upgrade',
  'accept-encoding',
]);

/** Response headers dropped before handing the body to the browser. */
const DROPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'proxy-authenticate',
  'trailer',
  'upgrade',
]);

const DECODERS: Record<
  string,
  () => zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | zlib.ZstdDecompress
> = {
  gzip: () => zlib.createGunzip(),
  'x-gzip': () => zlib.createGunzip(),
  deflate: () => zlib.createInflate(),
  br: () => zlib.createBrotliDecompress(),
  zstd: () => zlib.createZstdDecompress(),
};

/**
 * Builds the socket `lookup` hook: one resolution, checked, then used for the
 * connection. Exported for tests.
 */
export function createGuardedLookup(lookup: LookupAll, allowPrivateHosts: boolean): LookupFunction {
  return (hostname, options, callback) => {
    resolveAndCheck(hostname, lookup, { allowPrivateHosts })
      .then((addresses) => {
        const family = typeof options === 'object' ? options.family : undefined;
        const wanted =
          family === 4 || family === 6 ? addresses.filter((a) => a.family === family) : addresses;
        if (wanted.length === 0) {
          callback(new AnalysisError('dns_failure'), '', 4);
          return;
        }
        if (typeof options === 'object' && options.all) {
          (callback as unknown as (e: null, a: typeof wanted) => void)(null, wanted);
        } else {
          const first = wanted[0]!;
          callback(null, first.address, first.family);
        }
      })
      .catch((error: unknown) => callback(error as NodeJS.ErrnoException, '', 4));
  };
}

function flattenHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    const key = name.toLowerCase();
    if (DROPPED_RESPONSE_HEADERS.has(key)) continue;
    out[key] = Array.isArray(value) ? value.join(key === 'set-cookie' ? '\n' : ', ') : value;
  }
  return out;
}

function forwardableHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    const key = name.toLowerCase();
    if (key.startsWith(':') || key.startsWith('proxy-') || DROPPED_REQUEST_HEADERS.has(key))
      continue;
    out[key] = value;
  }
  out['accept-encoding'] = 'gzip, deflate, br';
  return out;
}

function tooLarge(): AnalysisError {
  return new AnalysisError(
    'too_large',
    'Une ressource de la page dépasse la taille maximale autorisée.',
  );
}

/** Reads a stream into a Buffer, failing as soon as `maxBytes` or the shared budget is exceeded. */
async function readCapped(
  stream: Readable,
  maxBytes: number,
  budget?: { remaining: number },
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (budget) budget.remaining -= buf.length;
    if (total > maxBytes || (budget && budget.remaining < 0)) {
      stream.destroy();
      throw tooLarge();
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks, total);
}

/**
 * Performs one HTTP(S) request without following redirects. 3xx responses are
 * returned as-is so that the caller (the browser) re-issues a new request,
 * which goes through the same checks.
 */
export async function safeFetch(
  req: SafeFetchRequest,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResponse> {
  const allowPrivateHosts = options.allowPrivateHosts === true;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_RESOURCE_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const lookup = options.lookup ?? defaultLookup;

  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    throw new AnalysisError('invalid_url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AnalysisError(
      'forbidden_target',
      'Seules les adresses en http ou https sont acceptées.',
    );
  }
  if (url.username !== '' || url.password !== '') {
    throw new AnalysisError('forbidden_target');
  }
  if (!allowPrivateHosts && !ALLOWED_PORTS.includes(url.port)) {
    throw new AnalysisError('forbidden_target', 'Seuls les ports 80 et 443 sont acceptés.');
  }
  const host = normalizeHost(url.hostname);
  // Node does not call `lookup` for IP literals: check them here.
  if (isIP(host) !== 0) await resolveAndCheck(host, lookup, { allowPrivateHosts });

  if (maxBytes <= 0) throw tooLarge();
  if (options.signal?.aborted)
    throw new AnalysisError('unreachable', 'La requête a été interrompue.');

  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;
  const agent = options.agents ? (isHttps ? options.agents.https : options.agents.http) : false;

  return new Promise<SafeFetchResponse>((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      request.destroy();
      reject(
        error instanceof AnalysisError
          ? error
          : new AnalysisError('unreachable', undefined, { cause: error }),
      );
    };
    const onAbort = (): void =>
      fail(new AnalysisError('unreachable', 'La requête a été interrompue.'));
    const timer = setTimeout(
      () => fail(new AnalysisError('unreachable', 'Le délai de réponse du serveur a été dépassé.')),
      timeoutMs,
    );
    const cleanup = (): void => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: host,
        port: url.port === '' ? undefined : Number(url.port),
        path: `${url.pathname}${url.search}`,
        method: (req.method ?? 'GET').toUpperCase(),
        headers: forwardableHeaders(req.headers),
        agent,
        lookup: createGuardedLookup(lookup, allowPrivateHosts),
        servername: isIP(host) === 0 ? host : undefined,
      },
      (res) => {
        const remoteAddress = res.socket?.remoteAddress;
        const declared = Number(res.headers['content-length']);
        if (Number.isFinite(declared) && declared > maxBytes && !res.headers['content-encoding']) {
          res.destroy();
          fail(tooLarge());
          return;
        }
        const encoding = (res.headers['content-encoding'] ?? '').trim().toLowerCase();
        const makeDecoder = DECODERS[encoding];
        const stream: Readable = makeDecoder ? res.pipe(makeDecoder()) : res;
        if (makeDecoder) res.on('error', (e) => stream.destroy(e));
        readCapped(stream, maxBytes, options.budget)
          .then((body) => {
            if (settled) return;
            settled = true;
            cleanup();
            const headers = flattenHeaders(res.headers);
            if (makeDecoder) delete headers['content-encoding'];
            resolve({ url: url.href, status: res.statusCode ?? 0, headers, body, remoteAddress });
          })
          .catch(fail);
      },
    );
    request.on('error', fail);
    if (req.body && req.body.length > 0) request.write(req.body);
    request.end();
  });
}

/** Creates keep-alive agents for one analysis (call `destroy` at the end). */
export function createAgents(): { http: http.Agent; https: https.Agent; destroy: () => void } {
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 6 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 6 });
  return {
    http: httpAgent,
    https: httpsAgent,
    destroy: () => {
      httpAgent.destroy();
      httpsAgent.destroy();
    },
  };
}
