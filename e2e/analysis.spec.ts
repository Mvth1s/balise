import { readFile } from 'node:fs/promises';
import {
  analyse,
  CLIENT_HEADER,
  expect,
  expectNoAxeViolations,
  gotoReady,
  openDisclosure,
  scriptProgress,
  submitUrl,
  test,
} from './fixtures.ts';

test.describe('Parcours d’analyse', () => {
  test('saisie de l’URL, 5 étapes avec barre de progression, puis rapport', async ({ page }) => {
    await scriptProgress(page);
    await gotoReady(page, '/');
    await submitUrl(page, 'https://www.exemple.fr/contact');

    await expect(page).toHaveURL(/\/analyses\/[A-Za-z0-9_-]{8,}$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Analyse en cours' })).toBeVisible();
    await expect(page.getByText('https://www.exemple.fr/contact')).toBeVisible();
    const bar = page.getByRole('progressbar', { name: 'Avancement de l’analyse' });
    await expect(page.locator('.step')).toHaveCount(5);
    for (const [index, value] of ['20', '40', '60', '80', '100'].entries()) {
      await expect(bar).toHaveAttribute('aria-valuenow', value);
      await expect(page.locator('.step--done')).toHaveCount(index + 1);
      if (index === 1) await expectNoAxeViolations(page); // "analyse en cours" state
    }
    await expect(page.getByRole('status').filter({ hasText: 'Étape' })).toHaveText(/Étape 5 sur 5/);

    const heading = page.getByRole('heading', { level: 1, name: 'Rapport de pré-diagnostic' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText('Analyse terminée. Le rapport est affiché.')).toBeAttached();
    await expect(page.getByText(/Scores indicatifs\. Ils ne constituent pas/)).toBeVisible();
    await expect(
      page.getByRole('img', { name: /^Score global indicatif : \d+ sur 100/ }),
    ).toBeVisible();
    await expect(page.locator('.theme-row')).toHaveCount(13);
    await expect(page.getByText(/critères? testés? automatiquement sur \d+/).first()).toBeVisible();
    await expect(page).toHaveTitle(/^Rapport : /);

    // Unique, shareable URL: reloading shows the same report.
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(page.getByText('Titre de la page : Page de test (moteur simulé)')).toBeVisible();
  });

  test('annulation de l’analyse en cours', async ({ page }) => {
    await scriptProgress(page, { hold: true });
    await gotoReady(page, '/');
    await submitUrl(page, 'https://www.exemple.fr/');
    await expect(page.getByRole('heading', { level: 1, name: 'Analyse en cours' })).toBeVisible();
    const deleted = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && /\/api\/analyses\//.test(r.url()),
    );
    await page.getByRole('button', { name: 'Annuler l’analyse' }).click();
    expect((await deleted).status()).toBe(202);
    const heading = page.getByRole('heading', { level: 1, name: 'Analyse annulée' });
    await expect(heading).toBeFocused();
    await expect(page.getByRole('link', { name: 'Lancer une nouvelle analyse' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('l’API enregistre l’annulation d’une analyse en cours', async ({ request, clientId }) => {
    const headers = { [CLIENT_HEADER]: clientId };
    const created = await request.post('/api/analyses', {
      headers,
      data: { url: 'https://www.exemple.fr/' },
    });
    expect(created.status()).toBe(202);
    const { id } = (await created.json()) as { id: string };
    const cancelled = await request.delete(`/api/analyses/${id}`);
    expect(cancelled.status()).toBe(202);
    expect(((await cancelled.json()) as { state: string }).state).toBe('cancelled');
    // The fake engine would have finished by now: the cancellation must stick.
    await new Promise((r) => setTimeout(r, 1000));
    const status = await request.get(`/api/analyses/${id}`);
    expect(((await status.json()) as { state: string }).state).toBe('cancelled');
  });

  test('« Essayer avec une page d’exemple » affiche le rapport pré-calculé', async ({ page }) => {
    await gotoReady(page, '/');
    await page.getByRole('link', { name: 'Essayer avec une page d’exemple' }).click();
    await expect(page).toHaveURL(/\/exemple\/avant$/);
    await expect(page.getByRole('heading', { level: 1, name: /^Rapport d’exemple/ })).toBeFocused();
    await expect(page.locator('.theme-row')).toHaveCount(13);
  });
});

test.describe('Rapport', () => {
  test('filtres par statut et par thématique', async ({ page }) => {
    await gotoReady(page, '/exemple/avant');
    // Level 1 shows the three priority fixes; the details only once opened.
    await expect(page.locator('.report__fix-list > li')).toHaveCount(3);
    await expect(page.locator('#details article').first()).toBeHidden();
    await openDisclosure(page, /^Afficher le détail des/);
    const nonConformes = page.getByRole('button', { name: /^Non conformes \((\d+)\)$/ });
    const conformes = page.getByRole('button', { name: /^Conformes, test automatique/ });
    const counter = page.locator('#details [role="status"]');
    const items = page.locator('#details article');

    await expect(nonConformes).toHaveAttribute('aria-pressed', 'true');
    const nc = Number(/\((\d+)\)/.exec((await nonConformes.textContent()) ?? '')?.[1]);
    expect(nc).toBeGreaterThan(0);
    await expect(items).toHaveCount(nc);
    await expect(counter).toHaveText(`${nc} critères affichés`);
    await expect(items.first()).toContainText('Non conforme');

    await conformes.click();
    await expect(conformes).toHaveAttribute('aria-pressed', 'true');
    const c = Number(/\((\d+)\)/.exec((await conformes.textContent()) ?? '')?.[1]);
    await expect(items).toHaveCount(nc + c);
    await expectNoAxeViolations(page);

    await page.getByLabel('Thématique', { exact: true }).selectOption({ label: '1. Images' });
    await expect(items.first()).toBeVisible();
    // Filtered-out items leave the list on the next frames (TransitionGroup): poll.
    await expect
      .poll(async () =>
        (await items.locator('.criterion__title').allTextContents()).every((text) =>
          /^\s*Critère 1\.\d+/.test(text),
        ),
      )
      .toBe(true);
    await expectNoAxeViolations(page);

    await nonConformes.click();
    await conformes.click();
    await expect(items).toHaveCount(0);
    await expect(page.getByText('Aucun critère ne correspond à ces filtres.')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('accordéon des éléments concernés', async ({ page }) => {
    await gotoReady(page, '/exemple/avant');
    await openDisclosure(page, /^Afficher le détail des/);
    const summary = page.locator('#details article summary').first();
    await summary.click();
    const details = page.locator('#details article details').first();
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('code').first()).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('copier le lien du rapport', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoReady(page, '/exemple/avant');
    await page.getByRole('button', { name: 'Copier le lien du rapport' }).click();
    await expect(page.getByText('Lien du rapport copié.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  });

  test('export JSON', async ({ page }) => {
    await gotoReady(page, '/exemple/avant');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter en JSON' }).click();
    const file = await download;
    const report = JSON.parse(await readFile(await file.path(), 'utf8')) as {
      id: string;
      criteria: unknown[];
    };
    expect(report.id).toBeTruthy();
    expect(file.suggestedFilename()).toBe(`balise-rapport-${report.id}.json`);
    expect(report.criteria.length).toBeGreaterThan(100);
  });

  test('checklist manuelle conservée après rechargement', async ({ page }) => {
    await gotoReady(page, '/exemple/avant');
    await openDisclosure(page, /^Afficher la liste des/);
    const boxes = page.locator('.checklist input[type="checkbox"]');
    await boxes.nth(0).check();
    await boxes.nth(2).check();
    await expect(page.getByText(/^2 sur \d+ cochés\./)).toBeVisible();
    await expectNoAxeViolations(page);
    await page.reload();
    await openDisclosure(page, /^Afficher la liste des/);
    await expect(boxes.nth(0)).toBeChecked();
    await expect(boxes.nth(1)).not.toBeChecked();
    await expect(boxes.nth(2)).toBeChecked();
    await expect(page.getByText(/^2 sur \d+ cochés\./)).toBeVisible();
  });

  test('rapport d’une analyse réelle (capture d’écran)', async ({ page }) => {
    await analyse(page);
    await page.getByText('Voir la capture d’écran de la page analysée').click();
    const img = page.getByRole('img', { name: /^Capture d’écran de la page analysée/ });
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expectNoAxeViolations(page);
  });
});

test.describe('Erreurs', () => {
  test('URL invalide', async ({ page }) => {
    await gotoReady(page, '/');
    const field = page.getByLabel('Adresse de la page à analyser');
    await submitUrl(page, 'ceci n’est pas une adresse');
    await expect(page.getByText(/Cette adresse n’est pas valide/)).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await submitUrl(page, 'ftp://exemple.fr/');
    await expect(page.getByText('L’adresse doit commencer par http:// ou https://.')).toBeVisible();
  });

  for (const target of ['http://127.0.0.1', 'http://[::1]', 'http://169.254.169.254']) {
    test(`adresse privée refusée : ${target}`, async ({ page, request, clientId }) => {
      await gotoReady(page, '/');
      await submitUrl(page, target);
      await expect(page.getByText(/Cette adresse désigne un réseau local ou privé/)).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
      // The API refuses it as well (the client check is only a usability aid).
      const res = await request.post('/api/analyses', {
        headers: { [CLIENT_HEADER]: clientId },
        data: { url: target },
      });
      expect(res.status()).toBe(422);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'forbidden_target',
      );
    });
  }

  test('adresse refusée par l’API (message affiché sur l’accueil)', async ({ page }) => {
    await gotoReady(page, '/');
    // Valid for the client check, refused by the server (port other than 80/443).
    await submitUrl(page, 'https://www.exemple.fr:8443/');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Adresse refusée');
    await expect(page.getByLabel('Adresse de la page à analyser')).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test('limite atteinte après 10 analyses', async ({ page, request, clientId }) => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request.post('/api/analyses', {
        headers: { [CLIENT_HEADER]: clientId },
        data: { url: `https://www.exemple.fr/page-${i}` },
      });
      expect(res.status()).toBe(202);
    }
    await gotoReady(page, '/');
    const posted = page.waitForResponse((r) => r.request().method() === 'POST');
    await submitUrl(page, 'https://www.exemple.fr/page-11');
    const res = await posted;
    expect(res.status()).toBe(429);
    expect(Number(res.headers()['retry-after'])).toBeGreaterThan(0);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Limite d’analyses atteinte');
    await expect(alert).toContainText('limite de 10 analyses par heure');
    await expect(page).toHaveURL(/\/$/);
    await expectNoAxeViolations(page);
  });

  test('page inaccessible', async ({ page }) => {
    await gotoReady(page, '/');
    await submitUrl(page, 'https://unreachable.exemple.fr/');
    const heading = page.getByRole('heading', { level: 1, name: 'Page inaccessible' });
    await expect(heading).toBeVisible();
    await expect(page.getByText(/Balise n’a pas pu charger cette page/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lancer une nouvelle analyse' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('analyse introuvable', async ({ page }) => {
    await gotoReady(page, '/analyses/inexistant-0000');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Analyse introuvable ou expirée' }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
