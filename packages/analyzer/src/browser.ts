/**
 * Chromium launch and hardened browser context.
 * - Vercel / Lambda: @sparticuz/chromium binary;
 * - local: Playwright's Chromium (`pnpm exec playwright install chromium`).
 */
import { chromium, type Browser, type BrowserContext } from 'playwright-core';

export const BOT_SIGNATURE = 'BaliseBot/1.0 (+https://github.com/Mvth1s/balise)';
export const VIEWPORT = { width: 1280, height: 800 } as const;

/**
 * Hardening flags. The dead proxy (port 9, "discard") is a safety net: any
 * request that would escape Playwright interception fails. `<-loopback>`
 * removes Chromium's implicit proxy bypass for localhost.
 */
export const HARDENING_ARGS: readonly string[] = [
  '--proxy-server=http://127.0.0.1:9',
  '--proxy-bypass-list=<-loopback>',
  '--dns-prefetch-disable',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-domain-reliability',
  '--disable-client-side-phishing-detection',
  '--disable-sync',
  '--no-pings',
  '--no-first-run',
  '--metrics-recording-only',
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--disable-features=NetworkPrediction,OptimizationHints,MediaRouter,DialMediaRouteProvider,Translate,AutofillServerCommunication,CertificateTransparencyComponentUpdater,InterestFeedContentSuggestions,DnsOverHttps',
];

export function isServerlessEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Chromium UA (major version, reduced form) + Balise signature. */
export function buildUserAgent(chromiumVersion: string): string {
  const major = chromiumVersion.split('.')[0] || '0';
  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 ${BOT_SIGNATURE}`;
}

export interface LaunchOptions {
  env?: NodeJS.ProcessEnv;
  /** Overrides the executable (tests). */
  executablePath?: string;
}

export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  const env = options.env ?? process.env;
  if (isServerlessEnv(env) && !options.executablePath) {
    const { default: Sparticuz } = await import('@sparticuz/chromium');
    return chromium.launch({
      executablePath: await Sparticuz.executablePath(),
      args: [...Sparticuz.args, ...HARDENING_ARGS],
      headless: true,
    });
  }
  return chromium.launch({
    headless: true,
    args: [...HARDENING_ARGS],
    ...(options.executablePath ? { executablePath: options.executablePath } : {}),
  });
}

export async function createHardenedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    acceptDownloads: false,
    serviceWorkers: 'block',
    javaScriptEnabled: true,
    viewport: { ...VIEWPORT },
    locale: 'fr-FR',
    userAgent: buildUserAgent(browser.version()),
    ignoreHTTPSErrors: false,
    bypassCSP: false,
    permissions: [],
  });
}
