import type { Page } from '@playwright/test';
import {
  expect,
  expectNoHorizontalScroll,
  gotoReady,
  openDisclosure,
  LEGAL_PAGES,
  test,
  waitHydrated,
} from './fixtures.ts';

const REFLOW_PAGES = [
  '/',
  '/exemple',
  '/exemple/avant',
  '/exemple/apres',
  '/demo/apres',
  '/analyses',
  '/introuvable',
  ...LEGAL_PAGES.map((p) => p.path),
];

async function expectFocusVisible(page: Page) {
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(outline, 'an element has the focus').not.toBeNull();
  expect(outline?.style).not.toBe('none');
  expect(outline?.width ?? 0).toBeGreaterThan(0);
}

/** Presses Tab until `target` has the focus, checking focus visibility on the way. */
async function tabTo(page: Page, target: import('@playwright/test').Locator, max = 40) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    await expectFocusVisible(page);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`focus never reached ${target.toString()}`);
}

test.describe('Clavier seul', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard journey: desktop project');

  test('lien d’évitement', async ({ page }) => {
    await gotoReady(page, '/mentions-legales');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Aller au contenu' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await expectFocusVisible(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenu')).toBeFocused();
    await page.keyboard.press('Tab');
    // Next stop is inside the main content (breadcrumb), not the header.
    expect(
      await page.evaluate(() =>
        document.getElementById('contenu')?.contains(document.activeElement),
      ),
    ).toBe(true);
  });

  test('parcours complet de l’accueil au rapport', async ({ page }) => {
    await gotoReady(page, '/');
    const field = page.getByLabel('Adresse de la page à analyser');
    await tabTo(page, field);
    await page.keyboard.type('https://www.exemple.fr/clavier');
    await page.keyboard.press('Enter');

    const heading = page.getByRole('heading', { level: 1, name: 'Rapport de pré-diagnostic' });
    await expect(heading).toBeVisible();
    await expect(page).toHaveURL(/\/analyses\//);

    // Criterion details open with Enter, then status filter with Space.
    const more = page.locator('summary').filter({ hasText: /^Afficher le détail des/ });
    await tabTo(page, more, 40);
    await page.keyboard.press('Enter');
    const conformes = page.getByRole('button', { name: /^Conformes, test automatique/ });
    await tabTo(page, conformes, 80);
    await page.keyboard.press('Space');
    await expect(conformes).toHaveAttribute('aria-pressed', 'true');
    const select = page.getByLabel('Thématique', { exact: true });
    await tabTo(page, select);
    await select.press('ArrowDown');
    await expect(select).not.toHaveValue('');

    // Accordion with Enter, checklist with Space.
    await select.selectOption('');
    const summary = page.locator('#details article summary').first();
    await tabTo(page, summary, 20);
    await page.keyboard.press('Enter');
    await expect(page.locator('#details article details').first()).toHaveAttribute('open', '');
    const manual = page.locator('summary').filter({ hasText: /^Afficher la liste des/ });
    await tabTo(page, manual, 300);
    await page.keyboard.press('Enter');
    const box = page.locator('.checklist input[type="checkbox"]').first();
    await tabTo(page, box, 20);
    await page.keyboard.press('Space');
    await expect(box).toBeChecked();
  });

  test('bascule du thème et des animations au clavier', async ({ page }) => {
    await gotoReady(page, '/');
    const theme = page.getByLabel('Thème', { exact: true });
    await tabTo(page, theme);
    await theme.press('ArrowDown');
    await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
    const motion = page.getByRole('switch', { name: 'Animations' });
    await tabTo(page, motion);
    await page.keyboard.press('Space');
    await expect(motion).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('Affichage', () => {
  test('320 px sans défilement horizontal', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-320 project');
    expect(page.viewportSize()?.width).toBe(320);
    for (const path of REFLOW_PAGES) {
      await gotoReady(page, path);
      await expectNoHorizontalScroll(page);
    }
    // Report with details opened (long selectors and HTML snippets).
    await gotoReady(page, '/exemple/avant');
    await openDisclosure(page, /^Afficher le détail des/);
    await page.locator('#details article summary').first().click();
    await expectNoHorizontalScroll(page);
  });

  test('zoom 200 % sans défilement horizontal', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project');
    // 1280 px at 200 % = 640 CSS px.
    await page.setViewportSize({ width: 640, height: 400 });
    for (const path of REFLOW_PAGES) {
      await gotoReady(page, path);
      await expectNoHorizontalScroll(page);
    }
  });

  test('zoom 200 % du texte (CSS zoom) : le contenu reste lisible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project');
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const path of ['/', '/exemple/avant', '/cookies']) {
      await gotoReady(page, path);
      await page.evaluate(() => (document.documentElement.style.zoom = '2'));
      await expectNoHorizontalScroll(page);
    }
  });

  test('prefers-reduced-motion : jauges affichées directement', async ({ page }) => {
    await gotoReady(page, '/exemple/avant');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    await expect(page.getByText('Réduites par votre système')).toBeVisible();
    await expectFinalGauges(page);
    // Also on a client-side mounted report (the case that animates otherwise).
    await page.getByRole('link', { name: 'Comparer avant et après correction' }).click();
    await page.locator('#contenu a[href="/exemple/apres"]').first().click();
    await expect(page).toHaveURL(/\/exemple\/apres$/);
    await expectFinalGauges(page);
  });
});

test.describe('Animations actives', () => {
  test.use({ reducedMotion: 'no-preference' });
  test.skip(({ isMobile }) => isMobile, 'desktop project');

  test('jauges qui se remplissent, interrupteur mémorisé', async ({ page }) => {
    await gotoReady(page, '/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    const { gauge, target, samples } = await recordCountUp(page);
    expect(samples[0], `count-up samples: ${samples.join(',')}`).toBeLessThan(target);
    expect(samples.at(-1)).toBe(target);
    // The accessible name never depends on the animation.
    await expect(gauge).toHaveAttribute('aria-label', new RegExp(`: ${target} sur 100`));

    await page.getByRole('switch', { name: 'Animations' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    await page.reload();
    await waitHydrated(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    await expect(page.getByRole('switch', { name: 'Animations' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  // Regression: the first rAF timestamp can precede performance.now().
  test('le compteur des jauges est croissant et jamais négatif', async ({ page }) => {
    await gotoReady(page, '/');
    const { samples } = await recordCountUp(page);
    expect(samples).toEqual([...samples].sort((x, y) => x - y));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
  });
});

/** From the home page, opens the example report and records its global gauge on every frame. */
async function recordCountUp(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { samples: string[] };
    w.samples = [];
    const tick = () => {
      const n = document.querySelector('.report__summary .gauge__number');
      if (n) w.samples.push(n.textContent?.trim() ?? '');
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // Client-side navigation: the gauge counts up from 0 to its final value.
  await page.getByRole('link', { name: 'Essayer avec une page d’exemple' }).click();
  await expect(page).toHaveURL(/\/exemple\/avant$/);
  const gauge = page.getByRole('img', { name: /^Score global indicatif : \d+ sur 100/ });
  const target = Number(
    /: (\d+) sur 100/.exec((await gauge.getAttribute('aria-label')) ?? '')?.[1],
  );
  expect(target).toBeGreaterThan(0);
  await expect(gauge.locator('.gauge__number')).toHaveText(String(target));
  const samples = (
    await page.evaluate(() => (window as unknown as { samples: string[] }).samples)
  ).map(Number);
  return { gauge, target, samples };
}

async function expectFinalGauges(page: Page) {
  const gauges = page.locator('svg.gauge');
  await expect(gauges.first()).toBeVisible();
  for (const gauge of await gauges.all()) {
    const label = (await gauge.getAttribute('aria-label')) ?? '';
    const score = /: (\d+) sur 100/.exec(label)?.[1];
    // Read synchronously: no count-up, the final value is there at once.
    expect((await gauge.locator('.gauge__number').textContent())?.trim()).toBe(score ?? '–');
  }
}
