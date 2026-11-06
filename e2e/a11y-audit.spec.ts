import { expect, expectNoHorizontalScroll, gotoReady, test } from './fixtures.ts';

/** Regression tests for the anomalies of docs/accessibilite/audit-automatique.md. */
test.describe('Audit automatique : anomalies corrigées', () => {
  test('A1 : le focus suit le lien d’ancre « Comment ça marche »', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard journey: desktop project');
    for (const from of ['/', '/exemple']) {
      await gotoReady(page, from);
      const link = page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', {
          name: 'Comment ça marche',
        });
      await link.focus();
      await page.keyboard.press('Enter');
      await expect
        .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('#methode'))))
        .toBe(true);
      await page.keyboard.press('Tab');
      const inHeader = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('header')),
      );
      expect(
        inHeader,
        `Tab after the anchor (from ${from}) goes forward, not back to the header`,
      ).toBe(false);
    }
  });

  test('A2 : le cadre de /demo/apres a un focus visible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard journey: desktop project');
    await gotoReady(page, '/demo/apres');
    await page.getByRole('button', { name: 'S’abonner' }).focus();
    await page.keyboard.press('Tab');
    const frame = page.locator('iframe.demo-frame');
    await expect(frame).toHaveClass(/demo-frame--focus/);
    const outline = await frame.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Shift+Tab');
    await expect(frame).not.toHaveClass(/demo-frame--focus/);
  });

  test('A3 : titre de /analyses sans identifiant', async ({ page }) => {
    await gotoReady(page, '/analyses');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aucune analyse indiquée');
    await expect(page).toHaveTitle('Aucune analyse indiquée – Balise');
  });

  test('A4 : seul le logo porte aria-current sur l’accueil', async ({ page }) => {
    await gotoReady(page, '/');
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Balise, accueil' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('a[href="/#methode"]')).not.toHaveAttribute('aria-current');
  });

  test.describe('A5 : espacement du texte (WCAG 1.4.12) à 320 px', () => {
    // The CSP forbids injected <style>: bypass it for this user-style simulation only.
    test.use({ bypassCSP: true });

    test('aucun défilement horizontal', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'mobile-320 project');
      for (const path of ['/', '/exemple', '/exemple/avant', '/cookies', '/demo/apres']) {
        await gotoReady(page, path);
        await page.addStyleTag({
          content:
            '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
        });
        await expectNoHorizontalScroll(page);
      }
    });
  });
});
