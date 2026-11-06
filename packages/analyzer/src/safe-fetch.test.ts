import http from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AnalysisError } from './errors.js';
import { resolveAndCheck, type LookupAll } from './url-guard.js';
import { createAgents, createGuardedLookup, safeFetch } from './safe-fetch.js';

let server: http.Server;
let port: number;
let connections = 0;
const seenHosts: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    seenHosts.push(req.headers.host ?? '');
    const path = req.url ?? '/';
    if (path === '/html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('set-cookie', ['a=1', 'b=2']);
      res.end('<!doctype html><title>ok</title>');
    } else if (path === '/redirect-private') {
      res.statusCode = 302;
      res.setHeader('location', 'http://169.254.169.254/latest/meta-data/');
      res.end();
    } else if (path === '/gzip') {
      res.setHeader('content-encoding', 'gzip');
      res.end(zlib.gzipSync(Buffer.from('compressé')));
    } else if (path === '/br') {
      res.setHeader('content-encoding', 'br');
      res.end(zlib.brotliCompressSync(Buffer.from('brotli')));
    } else if (path === '/bomb') {
      res.setHeader('content-encoding', 'gzip');
      res.end(zlib.gzipSync(Buffer.alloc(2 * 1024 * 1024)));
    } else if (path === '/big') {
      res.setHeader('content-length', String(2 * 1024 * 1024));
      res.end(Buffer.alloc(2 * 1024 * 1024));
    } else if (path === '/chunked-big') {
      res.write(Buffer.alloc(600 * 1024));
      res.end(Buffer.alloc(600 * 1024));
    } else if (path === '/slow') {
      setTimeout(() => res.end('late'), 2000);
    } else if (path === '/echo') {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ method: req.method, body, headers: req.headers }));
      });
    } else {
      res.statusCode = 404;
      res.end('nope');
    }
  });
  server.on('connection', () => (connections += 1));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
});

const toLoopback: LookupAll = async () => [{ address: '127.0.0.1', family: 4 }];
const local = { lookup: toLoopback, allowPrivateHosts: true };

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AnalysisError);
    return (e as AnalysisError).code;
  }
  return undefined;
}

describe('safeFetch', () => {
  it('connects to the address returned by the single, checked resolution', async () => {
    const lookup = vi.fn(toLoopback);
    const res = await safeFetch(
      { url: `http://site.test:${port}/html` },
      { lookup, allowPrivateHosts: true },
    );
    expect(res.status).toBe(200);
    expect(res.body.toString()).toContain('<title>ok</title>');
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.headers['set-cookie']).toBe('a=1\nb=2');
    expect(res.headers['content-length']).toBeUndefined();
    expect(res.remoteAddress).toBe('127.0.0.1');
    expect(seenHosts.at(-1)).toBe(`site.test:${port}`);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('refuses a host resolving to a private address and never opens a socket', async () => {
    const before = connections;
    expect(await codeOf(safeFetch({ url: `http://site.test/html` }, { lookup: toLoopback }))).toBe(
      'forbidden_target',
    );
    expect(connections).toBe(before);
  });

  it('defeats DNS rebinding: public at submission, private at connection → refused', async () => {
    let calls = 0;
    const rebinding: LookupAll = async () => {
      calls += 1;
      return calls === 1
        ? [{ address: '93.184.216.34', family: 4 }]
        : [{ address: '127.0.0.1', family: 4 }];
    };
    // Submission-time check passes (first answer is public)...
    await expect(resolveAndCheck('rebind.test', rebinding)).resolves.toHaveLength(1);
    const before = connections;
    // ...but the connection resolves again, checks THAT answer and refuses.
    expect(await codeOf(safeFetch({ url: 'http://rebind.test/html' }, { lookup: rebinding }))).toBe(
      'forbidden_target',
    );
    expect(calls).toBe(2);
    expect(connections).toBe(before);
  });

  it('defeats DNS rebinding within one answer: one private record among public ones', async () => {
    const mixed: LookupAll = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ];
    expect(await codeOf(safeFetch({ url: 'http://mixed.test/html' }, { lookup: mixed }))).toBe(
      'forbidden_target',
    );
  });

  it('refuses private IP literals without calling lookup', async () => {
    const lookup = vi.fn(toLoopback);
    expect(await codeOf(safeFetch({ url: 'http://127.0.0.1/' }, { lookup }))).toBe(
      'forbidden_target',
    );
    expect(await codeOf(safeFetch({ url: 'http://[::1]/' }, { lookup }))).toBe('forbidden_target');
    expect(await codeOf(safeFetch({ url: 'http://2130706433/' }, { lookup }))).toBe(
      'forbidden_target',
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('refuses forbidden schemes, ports and credentials', async () => {
    expect(await codeOf(safeFetch({ url: 'ftp://site.test/' }, { lookup: toLoopback }))).toBe(
      'forbidden_target',
    );
    expect(await codeOf(safeFetch({ url: 'http://site.test:8080/' }, { lookup: toLoopback }))).toBe(
      'forbidden_target',
    );
    expect(await codeOf(safeFetch({ url: 'http://u:p@site.test/' }, { lookup: toLoopback }))).toBe(
      'forbidden_target',
    );
    expect(await codeOf(safeFetch({ url: 'not a url' }, { lookup: toLoopback }))).toBe(
      'invalid_url',
    );
  });

  it('does not follow redirects; the target is checked by the next request', async () => {
    const res = await safeFetch({ url: `http://127.0.0.1:${port}/redirect-private` }, local);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://169.254.169.254/latest/meta-data/');
    expect(await codeOf(safeFetch({ url: res.headers.location! }, { lookup: toLoopback }))).toBe(
      'forbidden_target',
    );
  });

  it('decompresses gzip and brotli and drops content-encoding', async () => {
    const gz = await safeFetch({ url: `http://127.0.0.1:${port}/gzip` }, local);
    expect(gz.body.toString()).toBe('compressé');
    expect(gz.headers['content-encoding']).toBeUndefined();
    const br = await safeFetch({ url: `http://127.0.0.1:${port}/br` }, local);
    expect(br.body.toString()).toBe('brotli');
  });

  it('caps the body size (declared, chunked and decompressed)', async () => {
    const opts = { ...local, maxBytes: 1024 * 1024 };
    expect(await codeOf(safeFetch({ url: `http://127.0.0.1:${port}/big` }, opts))).toBe(
      'too_large',
    );
    expect(await codeOf(safeFetch({ url: `http://127.0.0.1:${port}/chunked-big` }, opts))).toBe(
      'too_large',
    );
    expect(await codeOf(safeFetch({ url: `http://127.0.0.1:${port}/bomb` }, opts))).toBe(
      'too_large',
    );
    expect(
      await codeOf(safeFetch({ url: `http://127.0.0.1:${port}/html` }, { ...local, maxBytes: 0 })),
    ).toBe('too_large');
  });

  it('reserves a shared byte budget chunk by chunk', async () => {
    // 1.2 MB each: one fits in 1.5 MB, two do not.
    const budget = { remaining: 1500 * 1024 };
    const url = `http://127.0.0.1:${port}/chunked-big`;
    // Two parallel requests share one budget: the sum is capped, not each one.
    const codes = await Promise.all([
      codeOf(safeFetch({ url }, { ...local, budget })),
      codeOf(safeFetch({ url }, { ...local, budget })),
    ]);
    expect(codes).toContain('too_large');
    const alone = { remaining: 1500 * 1024 };
    expect(await codeOf(safeFetch({ url }, { ...local, budget: alone }))).toBeUndefined();
    const small = { remaining: 100 };
    const res = await safeFetch(
      { url: `http://127.0.0.1:${port}/html` },
      { ...local, budget: small },
    );
    expect(small.remaining).toBe(100 - res.body.length);
  });

  it('times out and honours abort signals', async () => {
    expect(
      await codeOf(
        safeFetch({ url: `http://127.0.0.1:${port}/slow` }, { ...local, timeoutMs: 100 }),
      ),
    ).toBe('unreachable');
    const controller = new AbortController();
    const p = safeFetch(
      { url: `http://127.0.0.1:${port}/slow` },
      { ...local, signal: controller.signal },
    );
    setTimeout(() => controller.abort(), 50);
    expect(await codeOf(p)).toBe('unreachable');
    expect(
      await codeOf(
        safeFetch(
          { url: `http://127.0.0.1:${port}/slow` },
          { ...local, signal: AbortSignal.abort() },
        ),
      ),
    ).toBe('unreachable');
  });

  it('forwards method, body and safe headers only', async () => {
    const agents = createAgents();
    try {
      const res = await safeFetch(
        {
          url: `http://127.0.0.1:${port}/echo`,
          method: 'post',
          body: Buffer.from('x=1'),
          headers: {
            'X-Test': 'yes',
            Host: 'evil.test',
            'Proxy-Authorization': 'secret',
            ':authority': 'x',
          },
        },
        { ...local, agents },
      );
      const echo = JSON.parse(res.body.toString()) as {
        method: string;
        body: string;
        headers: Record<string, string>;
      };
      expect(echo.method).toBe('POST');
      expect(echo.body).toBe('x=1');
      expect(echo.headers['x-test']).toBe('yes');
      expect(echo.headers.host).toBe(`127.0.0.1:${port}`);
      expect(echo.headers['proxy-authorization']).toBeUndefined();
      expect(echo.headers['accept-encoding']).toBe('gzip, deflate, br');
    } finally {
      agents.destroy();
    }
  });

  it('reports network errors as unreachable', async () => {
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r));
    const closedPort = (closed.address() as AddressInfo).port;
    await new Promise((r) => closed.close(r));
    expect(await codeOf(safeFetch({ url: `http://127.0.0.1:${closedPort}/` }, local))).toBe(
      'unreachable',
    );
  });

  it('reports DNS failures', async () => {
    const failing: LookupAll = async () => {
      throw new Error('ENOTFOUND');
    };
    expect(await codeOf(safeFetch({ url: 'http://absent.test/' }, { lookup: failing }))).toBe(
      'dns_failure',
    );
  });
});

describe('createGuardedLookup', () => {
  it('honours family and all options', async () => {
    const lookup = createGuardedLookup(
      async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1::1', family: 6 },
      ],
      false,
    );
    const call = (options: object) =>
      new Promise<unknown[]>((resolve) =>
        lookup('x.test', options as never, (...args: unknown[]) => resolve(args)),
      );
    expect(await call({ family: 6 })).toEqual([null, '2606:2800:220:1::1', 6]);
    expect(await call({})).toEqual([null, '93.184.216.34', 4]);
    expect(await call({ all: true })).toEqual([
      null,
      [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1::1', family: 6 },
      ],
    ]);
    const onlyV4 = createGuardedLookup(
      async () => [{ address: '93.184.216.34', family: 4 }],
      false,
    );
    const err = await new Promise<unknown>((resolve) =>
      onlyV4('x.test', { family: 6 }, (e) => resolve(e)),
    );
    expect((err as AnalysisError).code).toBe('dns_failure');
  });
});
