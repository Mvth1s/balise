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
 * removes Chromium's implicit proxy bypass for localhost. `--jitless` removes
 * the JIT compilers (main source of V8 exploits; also disables WebAssembly).
 * Features to disable are listed separately: see `buildLaunchArgs`.
 */
export const HARDENING_ARGS: readonly string[] = [
  '--proxy-server=http://127.0.0.1:9',
  '--proxy-bypass-list=<-loopback>',
  '--dns-prefetch-disable',
  '--disable-quic',
  '--js-flags=--jitless',
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
];

export const BALISE_DISABLED_FEATURES: readonly string[] = [
  'NetworkPrediction',
  'OptimizationHints',
  'MediaRouter',
  'DialMediaRouteProvider',
  'Translate',
  'AutofillServerCommunication',
  'CertificateTransparencyComponentUpdater',
  'InterestFeedContentSuggestions',
  'DnsOverHttps',
];

/**
 * Copy of Playwright 1.63.0's own `--disable-features` list
 * (server/chromium/chromiumSwitches.ts). Chromium keeps only the LAST
 * occurrence of a switch, so ours must include them; the identical default
 * argument is removed with `ignoreDefaultArgs`. Re-check on Playwright upgrade.
 */
export const PLAYWRIGHT_DISABLED_FEATURES: readonly string[] = [
  'AvoidUnnecessaryBeforeUnloadCheckSync',
  'DestroyProfileOnBrowserClose',
  'DialMediaRouteProvider',
  'GlobalMediaControls',
  'HttpsUpgrades',
  'LensOverlay',
  'MediaRouter',
  'PaintHolding',
  'ThirdPartyStoragePartitioning',
  'BlockOriginHeaderModificationOnRedirect',
  'Translate',
  'AutoDeElevate',
  'OptimizationHints',
  'msForceBrowserSignIn',
  'msEdgeUpdateLaunchServicesPreferredVersion',
];
export const PLAYWRIGHT_DISABLE_FEATURES_ARG = `--disable-features=${PLAYWRIGHT_DISABLED_FEATURES.join(',')}`;

/**
 * @sparticuz/chromium flags that weaken the browser's own protections:
 * same-origin policy, mixed content, site isolation trials. Its
 * `--enable-features=SharedArrayBuffer` is dropped too (it would also
 * override Playwright's `--enable-features`).
 */
export const FORBIDDEN_ARGS: readonly string[] = [
  '--disable-web-security',
  '--allow-running-insecure-content',
  '--disable-site-isolation-trials',
  '--enable-features=SharedArrayBuffer',
];

const DISABLE_FEATURES = '--disable-features=';

/**
 * Builds the Chromium arguments: platform arguments (Sparticuz on Vercel)
 * minus the forbidden ones, Balise hardening flags, and ONE merged
 * `--disable-features` (Playwright + platform + Balise). Pure, exported for tests.
 */
export function buildLaunchArgs(platformArgs: readonly string[] = []): string[] {
  const features = new Set(PLAYWRIGHT_DISABLED_FEATURES);
  const args: string[] = [];
  for (const arg of [...platformArgs, ...HARDENING_ARGS]) {
    if (FORBIDDEN_ARGS.includes(arg)) continue;
    if (arg.startsWith(DISABLE_FEATURES)) {
      for (const f of arg.slice(DISABLE_FEATURES.length).split(',')) if (f) features.add(f);
      continue;
    }
    if (!args.includes(arg)) args.push(arg);
  }
  for (const f of BALISE_DISABLED_FEATURES) features.add(f);
  args.push(`${DISABLE_FEATURES}${[...features].join(',')}`);
  return args;
}

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
  const common = { headless: true, ignoreDefaultArgs: [PLAYWRIGHT_DISABLE_FEATURES_ARG] };
  if (isServerlessEnv(env) && !options.executablePath) {
    const { default: Sparticuz } = await import('@sparticuz/chromium');
    // No WebGL / SwiftShader flags: less GPU attack surface, not needed for axe.
    Sparticuz.setGraphicsMode = false;
    return chromium.launch({
      ...common,
      executablePath: await Sparticuz.executablePath(),
      args: buildLaunchArgs(Sparticuz.args),
    });
  }
  return chromium.launch({
    ...common,
    args: buildLaunchArgs(),
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
