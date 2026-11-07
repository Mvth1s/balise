/**
 * Browser integration tests (real Chromium, pages served locally).
 * Grouped in one file sharing a single browser to keep them fast.
 */
import type { RgaaReference } from '@balise/rgaa-mapping';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { analyzePage } from './analyze.js';
import { createHardenedContext, launchBrowser } from './browser.js';
import { detectPagePresence, runChecks } from './checks/index.js';
import { AnalysisAbortedError, AnalysisError } from './errors.js';
import { navigate, type FetchFn } from './navigate.js';
import { runAxe } from './run-axe.js';
import { safeFetch } from './safe-fetch.js';
import { html, startFixtureServer, type FixtureServer } from './test-utils/fixture-server.js';
import type { LookupAll } from './url-guard.js';

const source = { url: 'https://accessibilite.numerique.gouv.fr/', retrieved: '2026-11-05' };
const rule = (
  r: string,
  engine: 'axe' | 'balise',
  criteria: string[],
  coverage: 'full' | 'partial' = 'full',
) => ({
  rule: r,
  engine,
  criteria,
  coverage,
  rationale: 'Test.',
  explanation: `Problème ${r}.`,
  fix: `Corriger ${r}.`,
  source,
});

const REF: RgaaReference = {
  version: 'test',
  name: 'RGAA test',
  sources: [source],
  themes: [
    { number: 1, title: 'Images' },
    { number: 8, title: 'Éléments obligatoires' },
    { number: 9, title: 'Structuration de l’information' },
    { number: 12, title: 'Navigation' },
  ],
  criteria: [
    { id: '1.1', theme: 1, title: 'Image porteuse d’information', url: 'https://x/#1.1' },
    { id: '8.3', theme: 8, title: 'Langue par défaut', url: 'https://x/#8.3' },
    { id: '8.5', theme: 8, title: 'Titre de page', url: 'https://x/#8.5' },
    { id: '9.1', theme: 9, title: 'Titres', url: 'https://x/#9.1' },
    { id: '12.7', theme: 12, title: 'Lien d’évitement', url: 'https://x/#12.7' },
    { id: '12.1', theme: 12, title: 'Sans règle', url: 'https://x/#12.1' },
  ],
  rules: [
    rule('image-alt', 'axe', ['1.1']),
    rule('html-has-lang', 'axe', ['8.3']),
    rule('balise-page-lang', 'balise', ['8.3']),
    rule('document-title', 'axe', ['8.5']),
    rule('balise-page-title', 'balise', ['8.5']),
    rule('balise-heading-hierarchy', 'balise', ['9.1'], 'partial'),
    rule('balise-skip-link', 'balise', ['12.7'], 'partial'),
    // Outside the WCAG tags: must still run because it is mapped.
    rule('region', 'axe', ['9.1'], 'partial'),
  ],
};

const GOOD = html(
  `<a href="#contenu">Aller au contenu</a><header><h1>Titre</h1></header>
   <main id="contenu"><h2>Section</h2><img src="/img.png" alt="Logo de test"><p>Texte</p></main>`,
);
const BAD = html(
  `<main><h1>Titre</h1><h3>Saut</h3><img src="/img.png"><img src="/img.png?2"></main>`,
  '<title> </title>',
  '',
);
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let server: FixtureServer;
let browser: Browser;
const loopback: LookupAll = async () => [{ address: '127.0.0.1', family: 4 }];

/** Fetch where only `site.test` may reach the local server; everything else is checked for real. */
const fetchSiteOnly: FetchFn = async (req, options) => {
  const host = new URL(req.url).hostname;
  const res = await safeFetch(req, {
    ...options,
    lookup: loopback,
    allowPrivateHosts: host === 'site.test',
  });
  // Pages reference the fixture server port through a {PORT} placeholder.
  if (!res.headers['content-type']?.startsWith('text/html')) return res;
  return {
    ...res,
    body: Buffer.from(res.body.toString().replaceAll('{PORT}', String(server.port))),
  };
};

beforeAll(async () => {
  server = await startFixtureServer({
    '/good': { body: GOOD },
    '/framed': { body: html('<h1>Cadre</h1><iframe title="Tarifs" src="/framed-child"></iframe>') },
    '/framed-child': { body: html('<table><tr><th>Tarif</th></tr></table>') },
    '/bad': { body: BAD },
    '/img.png': { headers: { 'content-type': 'image/png' }, body: PIXEL },
    '/pdf': { headers: { 'content-type': 'application/pdf' }, body: '%PDF-1.4' },
    '/gone': { status: 410, body: 'gone' },
    '/redirect': { status: 302, headers: { location: '/good' } },
    '/redirect-private': { status: 302, headers: { location: 'http://127.0.0.1/secret' } },
    '/secret': { body: html('<p>secret</p>') },
    '/redirect-loop': { status: 302, headers: { location: '/redirect-loop' } },
    '/redirect-file': { status: 301, headers: { location: 'file:///etc/passwd' } },
    '/img-redirect': { status: 307, headers: { location: '/img.png' } },
    '/img-redirect-cross': {
      status: 302,
      headers: { location: 'http://other.test:{PORT}/img.png?cross' },
    },
    '/img-redirect-private': {
      status: 302,
      headers: { location: 'http://127.0.0.1:{PORT}/secret-img' },
    },
    '/sub-redirects': {
      body: html(
        `<h1>r</h1><img src="/img-redirect" alt="a"><img src="/img-redirect-private" alt="b">
         <img src="/img-redirect-cross" alt="c">
         <script>
           fetch('/form-post', { method: 'POST', body: 'x' }).catch(() => 0);
           fetch('/form-post', { method: 'PUT' }).catch(() => 0);
         </script>`,
      ),
    },
    '/form-post': { status: 303, headers: { location: '/img.png' } },
    '/secret-img': { headers: { 'content-type': 'image/png' }, body: PIXEL },
    '/private-subresource': {
      body: html(
        `<h1>x</h1><img src="http://127.0.0.1:{PORT}/secret-img" alt="x"><img src="/img.png" alt="y">`,
      ),
    },
    '/many': {
      body: html(
        Array.from({ length: 12 }, (_, i) => `<img src="/img.png?${i}" alt="i">`).join(''),
      ),
    },
    '/ws': {
      body: html(
        `<h1>ws</h1><script>try { new WebSocket('ws://site.test:{PORT}/socket'); } catch (e) {}</script>`,
      ),
    },
    '/slow': { body: html('<h1>lent</h1>'), delayMs: 3000 },
    // Freezes the renderer as soon as axe-core is injected (after loading).
    '/axe-trap': {
      body: html(
        `<h1>piège</h1><script>Object.defineProperty(window, 'axe', { configurable: false, get() { return undefined; }, set() { for (;;) {} } });</script>`,
      ),
    },
  });
  browser = await launchBrowser();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function withPage<T>(fn: (page: import('playwright-core').Page) => Promise<T>): Promise<T> {
  const context = await createHardenedContext(browser);
  try {
    return await fn(await context.newPage());
  } finally {
    await context.close();
  }
}

const siteUrl = (path: string): string => `http://site.test:${server.port}${path}`;

describe('hardened browser', () => {
  it('identifies itself and uses the expected viewport and locale', async () => {
    await withPage(async (page) => {
      await navigate(page, siteUrl('/good'), { fetch: fetchSiteOnly });
      const info = (await page.evaluate(
        '({ ua: navigator.userAgent, lang: navigator.language, w: innerWidth, h: innerHeight })',
      )) as { ua: string; lang: string; w: number; h: number };
      expect(info.ua).toContain('BaliseBot/1.0 (+https://github.com/Mvth1s/balise)');
      expect(info.ua).not.toContain('Headless');
      expect(info.lang).toBe('fr-FR');
      expect([info.w, info.h]).toEqual([1280, 800]);
    });
  });

  it('dead proxy: a request escaping interception cannot reach the network', async () => {
    await withPage(async (page) => {
      const before = server.hits.length;
      await expect(page.goto(`${server.origin}/good`, { timeout: 10_000 })).rejects.toThrow();
      expect(server.hits.length).toBe(before);
    });
  });
});

describe('navigate', () => {
  it('loads a page, its sub-resources and takes a JPEG screenshot', async () => {
    await withPage(async (page) => {
      const res = await navigate(page, siteUrl('/good'), { fetch: fetchSiteOnly });
      expect(res.finalUrl).toBe(siteUrl('/good'));
      expect(res.status).toBe(200);
      expect(res.screenshot.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(res.stats.requests).toBeGreaterThanOrEqual(2);
    });
  });

  it('follows redirects through interception', async () => {
    await withPage(async (page) => {
      const res = await navigate(page, siteUrl('/redirect'), { fetch: fetchSiteOnly });
      expect(res.finalUrl).toBe(siteUrl('/good'));
    });
  });

  it('refuses a redirect to a private address', async () => {
    const before = server.hits.filter((h) => h === '/secret').length;
    await withPage(async (page) => {
      await expect(
        navigate(page, siteUrl('/redirect-private'), { fetch: fetchSiteOnly }),
      ).rejects.toMatchObject({
        code: 'forbidden_target',
      });
    });
    expect(server.hits.filter((h) => h === '/secret').length).toBe(before);
  });

  it('refuses redirect loops and non-http(s) redirect targets', async () => {
    await withPage(async (page) => {
      await expect(
        navigate(page, siteUrl('/redirect-loop'), { fetch: fetchSiteOnly }),
      ).rejects.toMatchObject({
        code: 'unreachable',
        message: 'La page effectue trop de redirections.',
      });
    });
    await withPage(async (page) => {
      await expect(
        navigate(page, siteUrl('/redirect-file'), { fetch: fetchSiteOnly }),
      ).rejects.toMatchObject({
        code: 'forbidden_target',
      });
    });
    await withPage(async (page) => {
      await expect(
        navigate(page, 'file:///etc/passwd', { fetch: fetchSiteOnly }),
      ).rejects.toMatchObject({
        code: 'forbidden_target',
      });
    });
  });

  it('follows same-origin sub-resource redirects in Node, only for GET/HEAD', async () => {
    const seen: string[] = [];
    const spy: FetchFn = async (req, options) => {
      seen.push(`${req.method} ${new URL(req.url).pathname}`);
      return fetchSiteOnly(req, options);
    };
    const before = server.hits.filter((h) => h === '/secret-img').length;
    await withPage(async (page) => {
      const res = await navigate(page, siteUrl('/sub-redirects'), { fetch: spy });
      expect(res.stats.blocked).toBeGreaterThanOrEqual(1);
    });
    expect(seen).toEqual(
      expect.arrayContaining([
        'GET /img-redirect',
        'GET /img.png',
        'GET /img-redirect-private',
        'GET /img-redirect-cross',
      ]),
    );
    // POST/PUT never leave the browser; cross-origin redirect hops are not followed.
    expect(seen.some((x) => x.includes('/form-post'))).toBe(false);
    expect(server.hits).not.toContain('/form-post');
    expect(seen.filter((x) => x === 'GET /img.png')).toHaveLength(1);
    expect(server.hits.filter((h) => h === '/secret-img').length).toBe(before);
  });

  it('blocks sub-resources pointing to private addresses', async () => {
    const pagePath = '/private-subresource';
    await withPage(async (page) => {
      const res = await navigate(page, siteUrl(pagePath), { fetch: fetchSiteOnly });
      expect(res.stats.blocked).toBeGreaterThanOrEqual(1);
    });
    expect(server.hits).not.toContain('/secret-img');
  });

  it('maps non-HTML and HTTP errors on the main document', async () => {
    await withPage(async (page) => {
      await expect(navigate(page, siteUrl('/pdf'), { fetch: fetchSiteOnly })).rejects.toMatchObject(
        { code: 'not_html' },
      );
    });
    await withPage(async (page) => {
      await expect(
        navigate(page, siteUrl('/gone'), { fetch: fetchSiteOnly }),
      ).rejects.toMatchObject({
        code: 'unreachable',
        message: 'La page a répondu avec le statut HTTP 410.',
      });
    });
  });

  it('enforces the request cap', async () => {
    await withPage(async (page) => {
      const res = await navigate(page, siteUrl('/many'), {
        fetch: fetchSiteOnly,
        limits: { maxRequests: 4 },
      });
      expect(res.stats.requests).toBe(4);
      expect(res.stats.blocked).toBeGreaterThan(0);
    });
  });

  it('enforces the cumulative size cap', async () => {
    await withPage(async (page) => {
      await expect(
        navigate(page, siteUrl('/good'), { fetch: fetchSiteOnly, limits: { maxTotalBytes: 10 } }),
      ).rejects.toMatchObject({ code: 'too_large' });
    });
  });

  it('blocks WebSockets', async () => {
    await withPage(async (page) => {
      const res = await navigate(page, siteUrl('/ws'), { fetch: fetchSiteOnly });
      expect(res.stats.blocked).toBeGreaterThanOrEqual(1);
    });
    expect(server.upgrades).toBe(0);
  });

  it('times out with unreachable and honours the abort signal', async () => {
    await withPage(async (page) => {
      await expect(
        navigate(page, siteUrl('/slow'), { fetch: fetchSiteOnly, limits: { loadTimeoutMs: 500 } }),
      ).rejects.toMatchObject({ code: 'unreachable' });
    });
    await withPage(async (page) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 200);
      await expect(
        navigate(page, siteUrl('/slow'), { fetch: fetchSiteOnly, signal: controller.signal }),
      ).rejects.toBeInstanceOf(AnalysisAbortedError);
    });
    await withPage(async (page) => {
      await expect(
        navigate(page, siteUrl('/good'), { fetch: fetchSiteOnly, signal: AbortSignal.abort() }),
      ).rejects.toBeInstanceOf(AnalysisAbortedError);
    });
  });

  it('reports a DNS failure on the main document', async () => {
    await withPage(async (page) => {
      await expect(
        navigate(page, 'http://absent.test/', {
          lookup: async () => {
            throw new Error('ENOTFOUND');
          },
        }),
      ).rejects.toMatchObject({ code: 'dns_failure' });
    });
  });
});

describe('axe and custom checks in the page', () => {
  it('detects element kinds inside frames too', async () => {
    await withPage(async (page) => {
      await navigate(page, siteUrl('/framed'), { fetch: fetchSiteOnly });
      await page.frameLocator('iframe').locator('table').waitFor();
      expect(await detectPagePresence(page)).toMatchObject({
        frames: true,
        tables: true,
        fields: false,
      });
      await navigate(page, siteUrl('/good'), { fetch: fetchSiteOnly });
      expect(await detectPagePresence(page)).toMatchObject({
        tables: false,
        images: true,
        links: true,
      });
    });
  });

  it('runs custom checks on a good page', async () => {
    await withPage(async (page) => {
      await navigate(page, siteUrl('/good'), { fetch: fetchSiteOnly });
      const results = await runChecks(page);
      const outcomes = Object.fromEntries(results.map((r) => [r.rule, r.outcome]));
      expect(outcomes).toMatchObject({
        'balise-skip-link': 'pass',
        'balise-heading-hierarchy': 'pass',
        'balise-page-lang': 'pass',
        'balise-page-title': 'pass',
        'balise-doctype': 'pass',
        'balise-duplicate-id': 'pass',
        'balise-img-alt-relevant': 'pass',
      });
    });
  });

  it('runs custom checks on a bad page', async () => {
    await withPage(async (page) => {
      await navigate(page, siteUrl('/bad'), { fetch: fetchSiteOnly });
      const results = await runChecks(page);
      const outcomes = Object.fromEntries(results.map((r) => [r.rule, r.outcome]));
      expect(outcomes).toMatchObject({
        'balise-skip-link': 'inapplicable',
        'balise-heading-hierarchy': 'fail',
        'balise-page-lang': 'fail',
        'balise-page-title': 'fail',
      });
      const headings = results.find((r) => r.rule === 'balise-heading-hierarchy')!;
      expect(headings.nodes[0]!.html).toBe('<h3>Saut</h3>');
    });
  });

  it('runs axe with WCAG tags plus mapped rules outside those tags', async () => {
    await withPage(async (page) => {
      await navigate(page, siteUrl('/bad'), { fetch: fetchSiteOnly });
      const results = await runAxe(page, ['region', 'image-alt', 'not-a-real-rule']);
      const byRule = new Map(results.map((r) => [r.rule, r]));
      expect(byRule.get('image-alt')?.outcome).toBe('fail');
      expect(byRule.get('image-alt')?.failures).toHaveLength(2);
      expect(byRule.has('region')).toBe(true);
      expect(byRule.has('not-a-real-rule')).toBe(false);
      expect(byRule.get('image-alt')?.helpUrl).toMatch(/^https:\/\/dequeuniversity\.com\//);
    });
  });
});

describe('analyzePage', () => {
  const launch = async (): Promise<Browser> => launchBrowser();

  it('produces a full report for a good page', async () => {
    const steps: string[] = [];
    const { report, screenshot } = await analyzePage(siteUrl('/good'), {
      id: 'test-good',
      reference: REF,
      lookup: loopback,
      allowPrivateHosts: true,
      launch,
      onStep: (s) => {
        steps.push(s);
      },
    });
    expect(steps).toEqual(['loading', 'testing', 'scoring']);
    expect(screenshot.length).toBeGreaterThan(100);
    expect(report).toMatchObject({
      schemaVersion: 1,
      id: 'test-good',
      url: siteUrl('/good'),
      finalUrl: siteUrl('/good'),
      reference: { name: 'RGAA test', version: 'test' },
      page: { title: 'Page de test', lang: 'fr' },
      hasScreenshot: true,
    });
    expect(report.engine.axe).toBe('4.14.0');
    expect(report.engine.chromium).toMatch(/^\d+\./);
    const status = Object.fromEntries(report.criteria.map((c) => [c.id, c.status]));
    expect(status).toEqual({
      '1.1': 'conforme',
      '8.3': 'conforme',
      '8.5': 'conforme',
      '9.1': 'a-verifier',
      '12.7': 'a-verifier',
      '12.1': 'a-verifier',
    });
    expect(report.scores.global).toMatchObject({ score: 100, tier: 'good', tested: 3, total: 6 });
    expect(report.scores.themes.find((t) => t.theme === 9)).toMatchObject({
      score: null,
      tier: null,
    });
  }, 60_000);

  it('produces findings for a bad page', async () => {
    const { report } = await analyzePage(siteUrl('/bad'), {
      reference: REF,
      lookup: loopback,
      allowPrivateHosts: true,
      launch,
    });
    const byId = new Map(report.criteria.map((c) => [c.id, c]));
    expect(byId.get('1.1')?.status).toBe('non-conforme');
    expect(byId.get('1.1')?.findings[0]).toMatchObject({
      rule: 'image-alt',
      engine: 'axe',
      count: 2,
    });
    expect(byId.get('8.3')?.status).toBe('non-conforme');
    expect(byId.get('9.1')?.status).toBe('non-conforme');
    expect(byId.get('9.1')?.findings.map((f) => f.rule)).toContain('balise-heading-hierarchy');
    expect(report.page.lang).toBeNull();
    expect(report.scores.global.score).toBe(0);
    expect(report.scores.global.tier).toBe('bad');
  }, 60_000);

  it('refuses private targets before launching a browser', async () => {
    let launched = false;
    await expect(
      analyzePage('http://127.0.0.1/', {
        reference: REF,
        launch: async () => {
          launched = true;
          return launchBrowser();
        },
      }),
    ).rejects.toMatchObject({ code: 'forbidden_target' });
    expect(launched).toBe(false);
  });

  it('maps unexpected failures to internal and honours cancellation', async () => {
    await expect(
      analyzePage(siteUrl('/good'), {
        reference: REF,
        lookup: loopback,
        allowPrivateHosts: true,
        launch: async () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toMatchObject({ code: 'internal' });
    await expect(
      analyzePage(siteUrl('/good'), { reference: REF, signal: AbortSignal.abort() }),
    ).rejects.toBeInstanceOf(AnalysisAbortedError);
    const controller = new AbortController();
    await expect(
      analyzePage(siteUrl('/good'), {
        reference: REF,
        lookup: loopback,
        allowPrivateHosts: true,
        launch,
        signal: controller.signal,
        onStep: (s) => {
          if (s === 'loading') controller.abort();
        },
      }),
    ).rejects.toBeInstanceOf(AnalysisAbortedError);
  }, 60_000);

  it('can be interrupted while a page script blocks axe-core', async () => {
    const controller = new AbortController();
    const started = Date.now();
    const run = analyzePage(siteUrl('/axe-trap'), {
      reference: REF,
      lookup: loopback,
      allowPrivateHosts: true,
      launch,
      signal: controller.signal,
      onStep: (s) => {
        if (s === 'loading') setTimeout(() => controller.abort(), 500);
      },
    });
    await expect(run).rejects.toBeInstanceOf(AnalysisAbortedError);
    expect(Date.now() - started).toBeLessThan(20_000);
  }, 60_000);

  it('exposes typed errors', () => {
    expect(new AnalysisError('not_html').message).toBe("L'adresse ne renvoie pas une page HTML.");
  });
});
