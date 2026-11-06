/**
 * Local HTTP server serving test pages (tests only, excluded from the build).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FixtureRoute {
  status?: number;
  headers?: Record<string, string>;
  body?: string | Buffer;
  delayMs?: number;
}

export interface FixtureServer {
  port: number;
  origin: string;
  hits: string[];
  upgrades: number;
  close: () => Promise<void>;
}

export async function startFixtureServer(
  routes: Record<string, FixtureRoute>,
): Promise<FixtureServer> {
  const hits: string[] = [];
  const state = { upgrades: 0 };
  const server = http.createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]!;
    hits.push(path);
    const route = routes[path];
    if (!route) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><title>404</title>');
      return;
    }
    const send = (): void => {
      res.statusCode = route.status ?? 200;
      for (const [k, v] of Object.entries(
        route.headers ?? { 'content-type': 'text/html; charset=utf-8' },
      )) {
        res.setHeader(k, v);
      }
      res.end(route.body ?? '');
    };
    if (route.delayMs) setTimeout(send, route.delayMs);
    else send();
  });
  server.on('upgrade', (_req, socket) => {
    state.upgrades += 1;
    socket.destroy();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    hits,
    get upgrades() {
      return state.upgrades;
    },
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

export const html = (body: string, head = '<title>Page de test</title>', lang = 'fr'): string =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
