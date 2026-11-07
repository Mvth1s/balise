/**
 * Interaction tests in a real Chromium: one deliberately broken page per
 * criterion, and a clean page that must pass everything.
 */
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHardenedContext, launchBrowser } from './browser.js';
import { observePage, runInteractions } from './interactions.js';
import { navigate, type FetchFn } from './navigate.js';
import { safeFetch } from './safe-fetch.js';
import { html, startFixtureServer, type FixtureServer } from './test-utils/fixture-server.js';

let server: FixtureServer;
let browser: Browser;
const fetchSiteOnly: FetchFn = (req, options) =>
  safeFetch(req, {
    ...options,
    lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    allowPrivateHosts: true,
  });

const CLEAN = html(
  `<a href="#m">Aller au contenu</a><main id="m"><h1>Titre</h1><p>Texte <a href="/a">lien</a></p>
   <button type="button">Action</button></main>`,
);

beforeAll(async () => {
  server = await startFixtureServer({
    '/clean': { body: CLEAN },
    '/trap': {
      body: html(
        `<h1>Piège</h1><button id="a">A</button><button id="b">B</button><a href="/x">Suite</a>
         <script>
           const a = document.getElementById('a'), b = document.getElementById('b');
           for (const [from, to] of [[a, b], [b, a]]) from.addEventListener('keydown', (e) => {
             if (e.key === 'Tab') { e.preventDefault(); to.focus(); }
           });
           a.focus();
         </script>`,
      ),
    },
    '/popup': { body: html(`<h1>P</h1><script>window.open('/clean');</script>`) },
    '/refresh': {
      body: html(`<h1>R</h1><script>setTimeout(() => location.replace('/clean'), 1200);</script>`),
    },
    '/moving': {
      body: html(
        `<h1>M</h1><div id="m" style="width:200px;height:50px;background:#000">Défile</div>
         <script>document.getElementById('m').animate([{transform:'translateX(0)'},{transform:'translateX(50px)'}],{duration:1000,iterations:Infinity});</script>`,
      ),
    },
    '/nofocus': {
      body: html(
        `<h1>F</h1><a href="/a" id="l">Lien</a>
         <script>document.adoptedStyleSheets=[Object.assign(new CSSStyleSheet(),{}).constructor ? (()=>{const s=new CSSStyleSheet();s.replaceSync('*:focus,*:focus-visible{outline:none!important;box-shadow:none!important}');return s;})() : null];</script>`,
      ),
    },
    '/hidden-stop': {
      body: html(
        `<h1>H</h1><a href="/a" style="position:absolute;left:-9999px">Invisible</a><a href="/b">Visible</a>`,
      ),
    },
    '/wide': {
      body: html(
        `<h1>W</h1><p style="width:600px;white-space:nowrap">Une ligne de texte bien trop large pour un écran de téléphone.</p>`,
      ),
    },
    '/clipped': {
      body: html(
        `<h1>C</h1><p style="height:2.6em;line-height:1.2;overflow:hidden;font-size:16px;margin:0">${'Un texte assez long pour tenir sur deux lignes à 1280 pixels de large, mais pas davantage. '.repeat(3)}</p>`,
      ),
    },
    '/tooltip': {
      body: html(
        `<h1>T</h1><nav><a href="/a" id="t" aria-describedby="tip">Aide</a></nav>
         <div id="tip" role="tooltip" style="display:none;position:absolute;top:200px;left:300px;padding:8px">Texte d’aide affiché au survol</div>
         <script>
           const t = document.getElementById('t'), tip = document.getElementById('tip');
           t.addEventListener('mouseenter', () => (tip.style.display = 'block'));
           t.addEventListener('mouseleave', () => (tip.style.display = 'none'));
         </script>`,
      ),
    },
    '/rotate': {
      body: html(
        `<h1>O</h1><div style="position:fixed;inset:0;background:#fff">Veuillez tourner votre appareil en mode paysage.</div>`,
      ),
    },
  });
  browser = await launchBrowser();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function outcomes(path: string): Promise<Record<string, string>> {
  const context = await createHardenedContext(browser);
  try {
    const page: Page = await context.newPage();
    const observation = observePage(page);
    await navigate(page, `http://site.test:${server.port}${path}`, {
      fetch: fetchSiteOnly,
      lookup: async () => [{ address: '127.0.0.1', family: 4 }],
      allowPrivateHosts: true,
    });
    const results = await runInteractions(page, observation, { idleMs: 2500 });
    return Object.fromEntries(results.map((r) => [r.rule, r.outcome]));
  } finally {
    await context.close();
  }
}

describe('interaction tests', () => {
  it('passes a clean page', async () => {
    expect(await outcomes('/clean')).toMatchObject({
      'balise-new-window': 'pass',
      'balise-auto-refresh': 'pass',
      'balise-moving-content': 'pass',
      'balise-keyboard-trap': 'pass',
      'balise-tab-order': 'pass',
      'balise-focus-visible': 'pass',
      'balise-text-spacing': 'pass',
      'balise-text-zoom': 'pass',
      'balise-reflow': 'pass',
      'balise-orientation': 'pass',
    });
  }, 60_000);

  it.each([
    ['/trap', 'balise-keyboard-trap'],
    ['/popup', 'balise-new-window'],
    ['/refresh', 'balise-auto-refresh'],
    ['/moving', 'balise-moving-content'],
    ['/nofocus', 'balise-focus-visible'],
    ['/hidden-stop', 'balise-tab-order'],
    ['/wide', 'balise-reflow'],
    ['/clipped', 'balise-text-spacing'],
    ['/clipped', 'balise-text-zoom'],
    ['/tooltip', 'balise-hover-content'],
    ['/rotate', 'balise-orientation'],
  ])(
    '%s fails %s',
    async (path, rule) => {
      expect((await outcomes(path))[rule]).toBe('fail');
    },
    60_000,
  );
});
