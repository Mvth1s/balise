/**
 * Local server for end-to-end tests and Lighthouse CI.
 *
 * One Node HTTP server (default port 4173) that reproduces the production
 * Vercel behaviour closely enough for tests:
 *   - serves the static build `apps/web/dist` with the same rules as Vercel
 *     (`cleanUrls: true`, `trailingSlash: false`, rewrites and headers read
 *     from `vercel.json`, so there is a single source of truth);
 *   - routes `/api/*` to the request handlers of `server/`.
 *
 * Usage: node --experimental-strip-types scripts/e2e-server.ts
 * Environment:
 *   PORT            listening port (default 4173)
 *   HOST            listening address (default 127.0.0.1)
 *   E2E_SERVER_API  set to "off" to serve static files only (Lighthouse CI):
 *                   `/api/*` then answers 503.
 *
 * TODO(backend/orchestrator): interface expected from `server/handlers.ts`.
 *   export function createHandlers(deps: HandlerDeps): ApiHandler
 *   where
 *     interface HandlerDeps { env: NodeJS.ProcessEnv }  // more fields allowed
 *     type ApiHandler =
 *       | ((request: Request) => Promise<Response>)
 *       | { fetch(request: Request): Promise<Response> };
 *   The handler receives a standard `Request` whose URL keeps the full path
 *   (`/api/analyses/:id`, ...) and must return a standard `Response`.
 *   Without KV_REST_API_URL/KV_REST_API_TOKEN, `server/` is expected to fall
 *   back to its in-memory store. Adjust `loadApiHandler()` below if the final
 *   export differs.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = resolve(ROOT, 'apps/web/dist');
const VERCEL_CONFIG = resolve(ROOT, 'vercel.json');
const HANDLERS_MODULE = new URL('../server/handlers.ts', import.meta.url).href;
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '127.0.0.1';
const API_ENABLED = process.env.E2E_SERVER_API !== 'off';
const MAX_BODY_BYTES = 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

interface VercelRoute {
  source: string;
  destination: string;
}
interface VercelHeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
interface VercelConfig {
  rewrites?: VercelRoute[];
  headers?: VercelHeaderRule[];
}

type ApiHandler = (request: Request) => Promise<Response>;

/** Minimal path-to-regexp conversion covering the patterns used in vercel.json. */
function toRegExp(source: string): RegExp {
  const pattern = source.replace(/:(\w+)/g, '(?<$1>[^/]+)');
  return new RegExp(`^${pattern}$`);
}

function applyParams(destination: string, groups: Record<string, string> | undefined): string {
  return destination.replace(/:(\w+)/g, (_match, name: string) => groups?.[name] ?? '');
}

async function loadVercelConfig(): Promise<VercelConfig> {
  return JSON.parse(await readFile(VERCEL_CONFIG, 'utf8')) as VercelConfig;
}

async function loadApiHandler(): Promise<ApiHandler | undefined> {
  if (!API_ENABLED) return undefined;
  const mod = (await import(HANDLERS_MODULE)) as {
    createHandlers?: (deps: { env: NodeJS.ProcessEnv }) => unknown;
  };
  if (typeof mod.createHandlers !== 'function') {
    throw new Error('server/handlers.ts must export createHandlers(deps).');
  }
  const created = mod.createHandlers({ env: process.env });
  if (typeof created === 'function') return created as ApiHandler;
  if (created && typeof (created as { fetch?: unknown }).fetch === 'function') {
    const target = created as { fetch: ApiHandler };
    return (request) => target.fetch(request);
  }
  throw new Error('createHandlers(deps) must return a function or an object with fetch().');
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Resolves a clean URL path to a file of the build, as Vercel does with cleanUrls. */
async function resolveStatic(pathname: string): Promise<string | undefined> {
  const relative = normalize(pathname).replace(/^([/\\])+/, '');
  const base = resolve(DIST_DIR, relative);
  if (base !== DIST_DIR && !base.startsWith(DIST_DIR + sep)) return undefined;
  const candidates =
    base === DIST_DIR
      ? [join(DIST_DIR, 'index.html')]
      : [base, `${base}.html`, join(base, 'index.html')];
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return undefined;
}

function headersFor(pathname: string, config: VercelConfig): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rule of config.headers ?? []) {
    if (toRegExp(rule.source).test(pathname)) {
      for (const { key, value } of rule.headers) result[key] = value;
    }
  }
  // This server speaks plain HTTP: `upgrade-insecure-requests` would rewrite
  // same-origin subresources to https://127.0.0.1 and break the page.
  const cspKey = Object.keys(result).find((key) => key.toLowerCase() === 'content-security-policy');
  if (cspKey) {
    result[cspKey] = (result[cspKey] ?? '')
      .split(';')
      .map((directive) => directive.trim())
      .filter((directive) => directive && directive !== 'upgrade-insecure-requests')
      .join('; ');
  }
  return result;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  api: ApiHandler | undefined,
): Promise<void> {
  if (!api) {
    sendJsonError(res, 503, 'api_disabled', "L'API est désactivée sur ce serveur de test.");
    return;
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  // Same client IP headers as on Vercel.
  const ip = req.socket.remoteAddress ?? '127.0.0.1';
  headers.set('x-forwarded-for', ip);
  headers.set('x-real-ip', ip);
  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
  const request = new Request(url, {
    method,
    headers,
    body: body ? new Uint8Array(body) : undefined,
  });
  const response = await api(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
}

function sendJsonError(res: ServerResponse, status: number, code: string, message: string): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: { code, message } }));
}

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 308;
  res.setHeader('location', location);
  res.end();
}

async function sendFile(
  res: ServerResponse,
  file: string,
  status: number,
  headers: Record<string, string>,
  method: string,
): Promise<void> {
  const content = await readFile(file);
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
  res.setHeader('content-length', content.length);
  res.end(method === 'HEAD' ? undefined : content);
}

async function handleStatic(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  config: VercelConfig,
): Promise<void> {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET, HEAD');
    res.end();
    return;
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.statusCode = 400;
    res.end();
    return;
  }
  // Collapses leading slashes and backslashes: "//host" in a Location header
  // would be a protocol-relative URL (open redirect).
  pathname = pathname.replace(/^[/\\]+/, '/');
  // trailingSlash: false
  if (pathname.length > 1 && pathname.endsWith('/')) {
    redirect(res, pathname.replace(/\/+$/, '') + url.search);
    return;
  }
  // cleanUrls: /page.html -> /page, /dir/index.html -> /dir
  if (pathname.endsWith('.html')) {
    const clean = pathname.replace(/(\/index)?\.html$/, '') || '/';
    redirect(res, clean + url.search);
    return;
  }

  const headers = headersFor(pathname, config);
  let file = await resolveStatic(pathname);
  if (!file) {
    for (const rewrite of config.rewrites ?? []) {
      const match = toRegExp(rewrite.source).exec(pathname);
      if (match) {
        file = await resolveStatic(applyParams(rewrite.destination, match.groups));
        if (file) break;
      }
    }
  }
  if (file) {
    await sendFile(res, file, 200, headers, method);
    return;
  }
  const notFound = join(DIST_DIR, '404.html');
  if (await isFile(notFound)) {
    await sendFile(res, notFound, 404, headers, method);
    return;
  }
  res.statusCode = 404;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

async function main(): Promise<void> {
  if (!(await isFile(join(DIST_DIR, 'index.html')))) {
    throw new Error(`No build found in ${DIST_DIR}. Run "pnpm build" first.`);
  }
  const config = await loadVercelConfig();
  const api = await loadApiHandler();

  const server = createServer((req, res) => {
    // A request target starting with "//" would otherwise be parsed as a host.
    const target = (req.url ?? '/').replace(/^[/\\]+/, '/');
    const url = new URL(target, `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
    const task =
      url.pathname === '/api' || url.pathname.startsWith('/api/')
        ? handleApi(req, res, url, api)
        : handleStatic(req, res, url, config);
    task.catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) sendJsonError(res, 500, 'internal_error', 'Erreur interne.');
      else res.end();
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`Balise e2e server ready on http://${HOST}:${PORT} (API ${api ? 'on' : 'off'})`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
