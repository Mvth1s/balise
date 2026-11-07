import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page, type Route } from '@playwright/test';

export { expect };

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
export const CLIENT_HEADER = 'x-balise-e2e-client';

/** Every footer link, in order (kickoff §4). */
export const FOOTER_LINKS = [
  'Mentions légales',
  'Politique de confidentialité',
  'Gestion des cookies',
  'Accessibilité : non conforme',
  'Conditions d’utilisation',
  'Plan du site',
  'Contact',
  'Code source',
];

export const LEGAL_PAGES = [
  { path: '/mentions-legales', title: 'Mentions légales' },
  { path: '/confidentialite', title: 'Politique de confidentialité' },
  { path: '/cookies', title: 'Gestion des cookies' },
  { path: '/accessibilite', title: 'Déclaration d’accessibilité' },
  { path: '/conditions-utilisation', title: 'Conditions d’utilisation' },
  { path: '/plan-du-site', title: 'Plan du site' },
  { path: '/contact', title: 'Contact' },
];

export const test = base.extend<{ clientId: string }>({
  // Own rate-limit bucket per test (honoured by the server in fake-analyzer mode only).
  clientId: [
    async ({ page }, use, testInfo) => {
      const id = `${testInfo.project.name}-${testInfo.testId}-${testInfo.retry}`;
      await page.setExtraHTTPHeaders({ [CLIENT_HEADER]: id });
      await use(id);
    },
    { auto: true },
  ],
});

/** Navigates and waits until the pre-rendered page is hydrated by Vue. */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitHydrated(page);
}

export async function waitHydrated(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Boolean((document.querySelector('#app') as { __vue_app__?: unknown } | null)?.__vue_app__),
  );
}

/** Zero axe violation (WCAG 2.2 AA tags). */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const summary = violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(' ')),
  }));
  expect(summary, `axe violations on ${page.url()}`).toEqual([]);
}

export async function submitUrl(page: Page, url: string): Promise<void> {
  await page.getByLabel('Adresse de la page à analyser').fill(url);
  await page.getByRole('button', { name: 'Analyser la page' }).click();
}

const STEPS = ['validated', 'queued', 'loading', 'testing', 'scoring'] as const;

/**
 * The fake engine finishes in about 0.5 s, faster than the 1.5 s polling:
 * scripts the polled status through the five steps (one per poll), from the
 * real server response, then lets the real final status through.
 */
export async function scriptProgress(page: Page, options: { hold?: boolean } = {}) {
  let polls = 0;
  await page.route(/\/api\/analyses\/[^/]+$/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const step = STEPS[polls];
    polls += 1;
    if (!step && !options.hold) return route.fallback();
    const response = await route.fetch();
    const real = (await response.json()) as Record<string, unknown>;
    delete real.report;
    delete real.error;
    await route.fulfill({
      response,
      json: {
        ...real,
        state: step === 'validated' ? 'pending' : 'running',
        step: step ?? 'testing',
      },
    });
  });
}

/** Starts a real analysis from the home page and waits for the report. */
export async function analyse(page: Page, url = 'https://www.exemple.fr/'): Promise<void> {
  await gotoReady(page, '/');
  await submitUrl(page, url);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rapport de pré-diagnostic' }),
  ).toBeVisible();
}

/** No horizontal scrolling at the current viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `horizontal scroll on ${page.url()}`).toBeLessThanOrEqual(clientWidth);
}
