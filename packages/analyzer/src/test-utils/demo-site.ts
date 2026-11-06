/**
 * Shared by `scripts/demo-build.ts` and the demo non-regression test:
 * serves the static web build and normalises demo reports so the versioned
 * JSON files are deterministic. Type-only imports so that Node can load this
 * file directly with --experimental-strip-types.
 */
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import type { AnalysisReport } from '../types.js';

/** Public base of the demo pages. shortcut: placeholder, update once the production domain is known. */
export const DEMO_PUBLIC_BASE = 'https://balise.vercel.app';
export const DEMO_ANALYZED_AT = '2026-11-06T00:00:00.000Z';
/** Illustrative duration: the real one varies from run to run. */
export const DEMO_DURATION_MS = 8000;
export const DEMO_VARIANTS = ['avant', 'apres'] as const;
export type DemoVariantName = (typeof DEMO_VARIANTS)[number];
export const DEMO_REBUILD_HINT = 'relancez pnpm demo:build si le changement est voulu';

export const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
export const WEB_DIST = join(REPO_ROOT, 'apps/web/dist');
export const DEMO_REPORTS_DIR = join(REPO_ROOT, 'apps/web/src/demo/reports');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

async function isFile(path: string): Promise<boolean> {
  return stat(path).then(
    (s) => s.isFile(),
    () => false,
  );
}

export async function assertWebBuild(dir = WEB_DIST): Promise<void> {
  if (!(await isFile(join(dir, 'demo/avant.html')))) {
    throw new Error(
      `Build du front introuvable (${dir}/demo/avant.html). Lancez « pnpm build » avant ce test ou pnpm demo:build.`,
    );
  }
}

/** Minimal static server with clean URLs (`/demo/avant` → `demo/avant.html`), like Vercel. */
export async function serveStatic(
  dir = WEB_DIST,
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    void (async () => {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      const base = resolve(dir, `.${path}`);
      if (base !== dir && !base.startsWith(dir + sep)) {
        res.statusCode = 403;
        res.end();
        return;
      }
      for (const file of [base, `${base}.html`, join(base, 'index.html')]) {
        if (await isFile(file)) {
          res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
          res.end(await readFile(file));
          return;
        }
      }
      res.statusCode = 404;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end('<!doctype html><title>404</title>');
    })().catch(() => {
      res.statusCode = 500;
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

/** Vue scoped-style attributes: their hash changes with the component source. */
const SCOPED_ATTR = /\s?data-v-[0-9a-f]{8}(="")?/g;
const SCOPED_SELECTOR = /\[data-v-[0-9a-f]{8}\]/g;

/** Rewrites the volatile fields of a report produced on a local server. */
export function normalizeDemoReport(
  report: AnalysisReport,
  variant: DemoVariantName,
): AnalysisReport {
  const url = `${DEMO_PUBLIC_BASE}/demo/${variant}`;
  return {
    ...report,
    id: `demo-${variant}`,
    url,
    finalUrl: url,
    analyzedAt: DEMO_ANALYZED_AT,
    durationMs: DEMO_DURATION_MS,
    hasScreenshot: false,
    criteria: report.criteria.map((c) => ({
      ...c,
      findings: c.findings.map((f) => ({
        ...f,
        nodes: f.nodes.map((n) => ({
          selector: n.selector.replace(SCOPED_SELECTOR, ''),
          html: n.html.replace(SCOPED_ATTR, ''),
        })),
      })),
    })),
  };
}

/** Stable part compared by the non-regression test: statuses per criterion, scores. */
export function demoSignature(report: AnalysisReport): {
  statuses: Record<string, string>;
  scores: AnalysisReport['scores'];
} {
  return {
    statuses: Object.fromEntries(report.criteria.map((c) => [c.id, c.status])),
    scores: report.scores,
  };
}
