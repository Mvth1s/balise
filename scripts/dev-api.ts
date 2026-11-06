/**
 * Local API for development (`pnpm dev:api`), proxied by Vite on `/api`.
 *
 * Runs the handlers of `server/` on http://127.0.0.1:3000 with the in-memory
 * store and rate limiter (unless KV_REST_API_URL/KV_REST_API_TOKEN are set)
 * and the real engine, which needs a local Chromium:
 *   pnpm exec playwright install chromium
 * Set BALISE_E2E_FAKE_ANALYZER=1 to use the fast fake engine instead.
 * `pnpm dev:api` builds the workspace packages first (Node loads their dist).
 *
 * Environment: PORT (default 3000), HOST (default 127.0.0.1).
 */
import { createServer, type IncomingMessage } from 'node:http';
import { createHandlers } from '../server/handlers.ts';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';
const MAX_BODY_BYTES = 64 * 1024;

const handle = createHandlers({ env: process.env });

async function readBody(req: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(chunk as Buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

const server = createServer((req, res) => {
  void (async () => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    // Same client IP header as on Vercel (never trust the incoming one).
    headers.set('x-real-ip', req.socket.remoteAddress ?? '127.0.0.1');
    const method = req.method ?? 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
    const response = await handle(
      new Request(`http://${HOST}:${PORT}${req.url ?? '/'}`, { method, headers, body }),
    );
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  })().catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify({ error: { code: 'internal', message: 'Erreur interne.' } }));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Balise API (dev) on http://${HOST}:${PORT}/api`);
});
