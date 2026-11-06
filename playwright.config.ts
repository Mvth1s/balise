import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (Playwright Test + axe).
 *
 * By default, tests run against `scripts/e2e-server.ts`, which serves the
 * static build `apps/web/dist` (run `pnpm build` first) and the local API.
 * Set E2E_BASE_URL to target a deployed environment (e.g. a Vercel preview);
 * no local server is started then. If the preview is protected, also set
 * VERCEL_AUTOMATION_BYPASS_SECRET (Protection Bypass for Automation).
 */
const LOCAL_PORT = 4173;
const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${LOCAL_PORT}`;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    // Fades and count-ups skew axe contrast checks mid-animation; the animated
    // behaviour has its own test (e2e/display.spec.ts) that opts back in.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(externalBaseUrl && bypassSecret
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': bypassSecret,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // RGAA / WCAG reflow: content must remain usable at 320 CSS px.
      name: 'mobile-320',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'node --experimental-strip-types scripts/e2e-server.ts',
        url: `http://127.0.0.1:${LOCAL_PORT}/`,
        // Fake engine: fast, no browser, no network ("unreachable" in the URL → error).
        env: { PORT: String(LOCAL_PORT), BALISE_E2E_FAKE_ANALYZER: '1' },
        reuseExistingServer: !isCI,
        timeout: 60_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
