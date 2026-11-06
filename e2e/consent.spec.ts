import type { Page } from '@playwright/test';
import { expect, expectNoAxeViolations, gotoReady, test, waitHydrated } from './fixtures.ts';

const GOOGLE = /google(tagmanager|-analytics)?\.|analytics\.google/;
const TEST_ID = 'G-E2ETEST01';

function recordGoogleRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (GOOGLE.test(new URL(r.url()).hostname)) urls.push(r.url());
  });
  return urls;
}

test.describe('Mesure d’audience', () => {
  test.skip(({ isMobile }) => isMobile, 'consent logic: desktop project is enough');

  test('build sans VITE_GA_MEASUREMENT_ID : ni bandeau ni requête Google', async ({ page }) => {
    const google = recordGoogleRequests(page);
    for (const path of ['/', '/exemple/avant', '/cookies']) {
      await gotoReady(page, path);
      await expect(page.getByRole('region', { name: 'Mesure d’audience' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Tout accepter' })).toHaveCount(0);
    }
    await expect(
      page.getByText('La mesure d’audience n’est pas activée sur ce site'),
    ).toBeVisible();
    expect(await page.evaluate(() => 'gtag' in window || 'dataLayer' in window)).toBe(false);
    expect(google).toEqual([]);
  });

  test.describe('build avec identifiant GA4 (simulé)', () => {
    let gtagLoads: string[];

    // The CI build has no VITE_GA_MEASUREMENT_ID. Rather than a second build, the
    // app chunk is served with the inlined empty id replaced by a test id;
    // gtag.js is answered locally (never reaches Google).
    test.beforeEach(async ({ page }) => {
      gtagLoads = [];
      await page.route(/\/assets\/app-[^/]+\.js$/, async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        // Minified `const measurementId = (… ?? '').trim(); analyticsConfigured = isValid(measurementId)`.
        const pattern =
          /(\w+)=``,(\w+=\w+\(\1\),\w+=\w+\(\{ready:!1,consent:null,lastChoice:null\}\))/;
        if (!pattern.test(body)) throw new Error('GA4 id pattern not found in the app chunk');
        await route.fulfill({ response, body: body.replace(pattern, `$1=\`${TEST_ID}\`,$2`) });
      });
      await page.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js/, async (route) => {
        gtagLoads.push(route.request().url());
        await route.fulfill({ contentType: 'text/javascript', body: '/* gtag stub */' });
      });
      await page.route(
        /^https:\/\/([a-z0-9-]+\.)*(google-analytics\.com|analytics\.google\.com)\//,
        (route) => route.fulfill({ status: 204 }),
      );
    });

    const banner = (page: Page) => page.getByRole('region', { name: 'Mesure d’audience' });

    test('bandeau affiché, accessible, sans script Google avant choix', async ({ page }) => {
      await gotoReady(page, '/');
      await expect(banner(page)).toBeVisible();
      const refuse = page.getByRole('button', { name: 'Tout refuser' });
      const accept = page.getByRole('button', { name: 'Tout accepter' });
      // Same look for both buttons.
      expect(await refuse.getAttribute('class')).toBe(await accept.getAttribute('class'));
      await expect(
        banner(page).getByRole('link', { name: 'Personnaliser mes choix' }),
      ).toBeVisible();
      // Not blocking: the form stays usable.
      await page.getByLabel('Adresse de la page à analyser').fill('https://www.exemple.fr/');
      expect(gtagLoads).toEqual([]);
      await expectNoAxeViolations(page);
    });

    test('refus : aucun script Google, choix mémorisé', async ({ page }) => {
      await gotoReady(page, '/');
      await page.getByRole('button', { name: 'Tout refuser' }).click();
      const confirmation = page
        .getByRole('status')
        .filter({ hasText: 'mesure d’audience refusée' });
      await expect(confirmation).toBeFocused();
      await expectNoAxeViolations(page);
      await page.getByRole('button', { name: 'Fermer ce message' }).click();
      await expect(confirmation).toHaveCount(0);
      await gotoReady(page, '/exemple');
      await expect(banner(page)).toHaveCount(0);
      expect(gtagLoads).toEqual([]);
      const stored = await page.evaluate(() => localStorage.getItem('balise:consent'));
      expect(JSON.parse(stored ?? '{}')).toMatchObject({ value: 'denied' });
    });

    test('acceptation puis retrait depuis « Gestion des cookies »', async ({ page }) => {
      await gotoReady(page, '/');
      await page.getByRole('button', { name: 'Tout accepter' }).click();
      await expect(page.getByText('mesure d’audience acceptée')).toBeVisible();
      await expect.poll(() => gtagLoads.length).toBe(1);
      expect(gtagLoads[0]).toContain(`id=${TEST_ID}`);

      // Granted consent survives a reload: gtag.js is loaded again, no banner.
      await page.reload();
      await waitHydrated(page);
      await expect(banner(page)).toHaveCount(0);
      await expect.poll(() => gtagLoads.length).toBe(2);

      // Client-side navigation.
      await page
        .getByRole('contentinfo')
        .getByRole('link', { name: 'Gestion des cookies' })
        .click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gestion des cookies');
      const toggle = page.getByRole('switch', { name: /Mesure d’audience/ });
      await expect(toggle).toBeChecked();
      await expectNoAxeViolations(page);
      await toggle.uncheck();
      await page
        .context()
        .addCookies([{ name: '_ga', value: 'GA1.1.123', domain: '127.0.0.1', path: '/' }]);
      await page.getByRole('button', { name: 'Enregistrer mes choix' }).click();
      await expect(page.getByText('Choix enregistré : mesure d’audience refusée.')).toBeVisible();
      expect(await page.evaluate(() => document.cookie)).not.toContain('_ga=');
      expect(
        await page.evaluate(
          (id) => (window as unknown as Record<string, unknown>)[`ga-disable-${id}`],
          TEST_ID,
        ),
      ).toBe(true);

      await page.reload();
      await waitAndCheckNoGtag(page);
    });

    // Regression: children mount before App.vue calls initConsent().
    test('chargement direct de /cookies : l’interrupteur reflète le consentement', async ({
      page,
    }) => {
      await gotoReady(page, '/');
      await page.getByRole('button', { name: 'Tout accepter' }).click();
      await gotoReady(page, '/cookies');
      await expect(page.getByRole('switch', { name: /Mesure d’audience/ })).toBeChecked();
    });

    test('choix expiré après 6 mois : le bandeau revient', async ({ page }) => {
      await page.addInitScript(() => {
        const old = new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString();
        localStorage.setItem('balise:consent', JSON.stringify({ value: 'granted', date: old }));
      });
      await gotoReady(page, '/');
      await expect(banner(page)).toBeVisible();
      expect(gtagLoads).toEqual([]);
    });
  });
});

async function waitAndCheckNoGtag(page: Page) {
  await page.waitForLoadState('networkidle');
  expect(
    await page.evaluate(() =>
      Array.from(document.scripts).some((s) => s.src.includes('googletagmanager')),
    ),
  ).toBe(false);
}
