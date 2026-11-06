import type { Page } from '@playwright/test';
import { expect, FOOTER_LINKS, gotoReady, LEGAL_PAGES, test } from './fixtures.ts';

const ALL_PAGES = ['/', '/exemple', '/exemple/avant', '/demo/avant', '/demo/apres', '/analyses'];

test.describe('Pages légales et pied de page', () => {
  test.skip(({ isMobile }) => isMobile, 'content checks: desktop project is enough');

  for (const { path, title } of LEGAL_PAGES) {
    test(`${path} : titre h1, titre de page et pied de page`, async ({ page }) => {
      await gotoReady(page, path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(loose(title));
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveTitle(loose(`${title} – Balise`));
      await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' })).toBeVisible();
      await expectFooter(page);
    });
  }

  test('pied de page identique sur les autres pages, y compris la 404', async ({ page }) => {
    for (const path of [...ALL_PAGES, '/introuvable']) {
      await page.goto(path);
      await expectFooter(page);
    }
  });

  test('les liens du pied de page mènent aux pages légales', async ({ page }) => {
    await gotoReady(page, '/');
    const footer = page.getByRole('navigation', { name: 'Liens de pied de page' });
    for (const { title } of LEGAL_PAGES) {
      const link = footer.getByRole('link').filter({
        hasText: title === 'Déclaration d’accessibilité' ? 'Accessibilité' : title,
      });
      await link.click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(loose(title));
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    }
  });

  test('plan du site : liens vers toutes les pages', async ({ page }) => {
    await gotoReady(page, '/plan-du-site');
    const main = page.locator('#contenu .prose');
    for (const href of [
      '/',
      '/exemple',
      '/demo/avant',
      '/demo/apres',
      '/mentions-legales',
      '/contact',
    ]) {
      await expect(main.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
  });

  test('aucune promesse de conformité', async ({ page }) => {
    for (const path of ['/', '/exemple/avant', '/accessibilite']) {
      await gotoReady(page, path);
      const text = (await page.locator('body').innerText()).toLowerCase();
      for (const forbidden of ['conforme rgaa', 'certifié', '100 % accessible']) {
        expect(text, `${path} contains "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });
});

/** Accepts both apostrophes: the pages are not consistent (see the e2e report). */
function loose(text: string): RegExp {
  return new RegExp(`^${text.replace(/[’']/g, "['’]")}$`);
}

async function expectFooter(page: Page) {
  const nav = page
    .getByRole('contentinfo')
    .getByRole('navigation', { name: 'Liens de pied de page' });
  await expect(nav.getByRole('link')).toHaveText(FOOTER_LINKS);
  await expect(page.getByRole('contentinfo')).toContainText(
    'Balise, par Mvth1s. Scores indicatifs, sans valeur de certification RGAA.',
  );
}
