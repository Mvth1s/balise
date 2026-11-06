import AxeBuilder from '@axe-core/playwright';
import {
  analyse,
  AXE_TAGS,
  expect,
  expectNoAxeViolations,
  gotoReady,
  LEGAL_PAGES,
  test,
} from './fixtures.ts';

// Analysis states (in progress, report, errors) and report states (filters,
// accordion, checklist) are checked with axe in analysis.spec.ts.
const PAGES = [
  '/',
  '/exemple',
  '/exemple/avant',
  '/exemple/apres',
  '/demo/apres',
  '/analyses',
  ...LEGAL_PAGES.map((p) => p.path),
];

test.describe('axe : zéro violation', () => {
  for (const path of PAGES) {
    test(`page ${path}`, async ({ page }) => {
      await gotoReady(page, path);
      await expectNoAxeViolations(page);
    });
  }

  test('page 404', async ({ page }) => {
    const res = await page.goto('/cette-page-n-existe-pas');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('accueil : erreur de saisie puis adresse valide', async ({ page }) => {
    await gotoReady(page, '/');
    const field = page.getByLabel('Adresse de la page à analyser');
    await field.fill('pas une adresse');
    await page.getByRole('button', { name: 'Analyser la page' }).click();
    await expect(page.locator('#url-error')).toBeVisible();
    await expectNoAxeViolations(page);
    await field.fill('https://www.exemple.fr/');
    await expect(page.getByText('Adresse valide')).toBeVisible();
    await expect(page.locator('#url-error')).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('thème sombre (accueil, rapport, page légale)', async ({ page }) => {
    await gotoReady(page, '/');
    await page.getByLabel('Thème', { exact: true }).selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoAxeViolations(page);
    for (const path of ['/exemple/avant', '/exemple', '/mentions-legales', '/demo/apres']) {
      await gotoReady(page, path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expectNoAxeViolations(page);
    }
  });

  test('thème sombre système, rapport en direct', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await analyse(page);
    await expectNoAxeViolations(page);
  });
});

test.describe('/demo/avant : erreurs volontaires', () => {
  test('a des violations, un bandeau d’avertissement et noindex', async ({ page }) => {
    const res = await page.goto('/demo/avant');
    expect(res?.headers()['x-robots-tag']).toBe('noindex');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const warning = page.getByRole('note').filter({ hasText: 'erreurs volontaires' });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Page de démonstration avec erreurs volontaires.');
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const ids = violations.map((v) => v.id);
    expect(ids.length).toBeGreaterThan(3);
    expect(ids).toEqual(expect.arrayContaining(['image-alt']));
    // The warning banner and Balise's own chrome stay accessible.
    await expectNoAxeViolationsOutside(page);
  });

  test('/demo/apres est indexable et sans bandeau d’erreurs', async ({ page }) => {
    await gotoReady(page, '/demo/apres');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.getByText('Page de démonstration corrigée.')).toBeVisible();
  });
});

async function expectNoAxeViolationsOutside(page: import('@playwright/test').Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('.demo-site')
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
}
