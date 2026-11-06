/**
 * GA4 audience measurement with a home-made consent (kickoff §4, CNIL rules).
 *
 * - No Google script before consent: gtag.js is injected only after "accept".
 * - Consent Mode: default "denied", then analytics_storage "granted".
 * - Google signals and ad personalisation disabled, cookies limited to 13 months.
 * - The choice is kept 6 months, then asked again.
 * - Withdrawal: consent update "denied", ga-disable flag, _ga* cookies deleted.
 */
import type { KeyValueStorage } from './storage';
import { browserStorage, readItem, removeItem, writeItem } from './storage';

export type ConsentValue = 'granted' | 'denied';

export const CONSENT_KEY = 'balise:consent';
/** Choice validity, in months. */
export const CONSENT_VALIDITY_MONTHS = 6;
/** GA cookie lifetime: 13 months (in seconds, 390 days). */
export const GA_COOKIE_EXPIRES = 33696000;
export const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js';

interface StoredConsent {
  value: ConsentValue;
  /** ISO date of the choice. */
  date: string;
}

export function isValidMeasurementId(id: string | undefined | null): id is string {
  return typeof id === 'string' && /^G-[A-Z0-9]{4,}$/i.test(id.trim());
}

export function consentExpiry(date: Date): Date {
  const expiry = new Date(date.getTime());
  expiry.setMonth(expiry.getMonth() + CONSENT_VALIDITY_MONTHS);
  return expiry;
}

/** The stored choice, or null when absent, invalid or older than 6 months. */
export function readConsent(
  storage: KeyValueStorage | null = browserStorage(),
  now: Date = new Date(),
): ConsentValue | null {
  const raw = readItem(CONSENT_KEY, storage);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.value !== 'granted' && parsed.value !== 'denied') return null;
    const date = new Date(parsed.date ?? '');
    if (Number.isNaN(date.getTime()) || date.getTime() > now.getTime() + 60_000) return null;
    if (consentExpiry(date).getTime() <= now.getTime()) {
      removeItem(CONSENT_KEY, storage);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeConsent(
  value: ConsentValue,
  storage: KeyValueStorage | null = browserStorage(),
  now: Date = new Date(),
): boolean {
  return writeItem(
    CONSENT_KEY,
    JSON.stringify({ value, date: now.toISOString() } satisfies StoredConsent),
    storage,
  );
}

type Gtag = (...args: unknown[]) => void;

interface GaWindow {
  dataLayer?: unknown[];
  gtag?: Gtag;
  [key: `ga-disable-${string}`]: boolean | undefined;
}

function gaWindow(win: Window): Window & GaWindow {
  return win as Window & GaWindow;
}

/** Defines dataLayer/gtag (no network request). */
function ensureGtag(win: Window): Gtag {
  const w = gaWindow(win);
  w.dataLayer = w.dataLayer ?? [];
  if (!w.gtag) {
    // gtag.js expects the Arguments object, not an array.
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer?.push(arguments);
    };
  }
  return w.gtag;
}

/**
 * Loads GA4 after consent. Idempotent. Returns false when nothing was loaded
 * (invalid id or SSR).
 */
export function loadAnalytics(measurementId: string, win: Window = window): boolean {
  if (!isValidMeasurementId(measurementId)) return false;
  const doc = win.document;
  const id = measurementId.trim();
  const w = gaWindow(win);
  w[`ga-disable-${id}`] = false;
  const gtag = ensureGtag(win);
  const src = `${GTAG_SRC}?id=${encodeURIComponent(id)}`;
  const already = Array.from(doc.scripts).some((s) => s.src === src);
  if (!already) {
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    gtag('js', new Date());
    gtag('config', id, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: GA_COOKIE_EXPIRES,
      // Page views are sent by trackPageView() on each route change.
      send_page_view: false,
    });
    const script = doc.createElement('script');
    script.async = true;
    script.src = src;
    doc.head.appendChild(script);
  }
  gtag('consent', 'update', { analytics_storage: 'granted' });
  return true;
}

export function trackPageView(path: string, title: string, win: Window = window): void {
  const w = gaWindow(win);
  if (!w.gtag) return;
  w.gtag('event', 'page_view', {
    page_path: path,
    page_location: win.location.origin + path,
    page_title: title,
  });
}

/** Candidate cookie domains: host, .host, and every parent domain. */
export function cookieDomains(hostname: string): string[] {
  const parts = hostname.split('.');
  const domains = new Set<string>(['', hostname]);
  for (let i = 0; i < parts.length - 1; i += 1) {
    const d = parts.slice(i).join('.');
    domains.add(d);
    domains.add(`.${d}`);
  }
  return [...domains];
}

/** Deletes the _ga and _ga_<id> cookies on every candidate domain. */
export function deleteGaCookies(doc: Document = document): string[] {
  const names = doc.cookie
    .split(';')
    .map((c) => c.split('=')[0]?.trim() ?? '')
    .filter((n) => /^_ga(_|$)/.test(n) || n === '_gid' || n === '_gat');
  const host = doc.location?.hostname ?? '';
  for (const name of names) {
    for (const domain of cookieDomains(host)) {
      const domainAttr = domain ? `; domain=${domain}` : '';
      doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`;
    }
  }
  return names;
}

/** Withdraws consent: stops GA4 and deletes its cookies. */
export function revokeAnalytics(measurementId: string, win: Window = window): void {
  const w = gaWindow(win);
  if (isValidMeasurementId(measurementId)) {
    w[`ga-disable-${measurementId.trim()}`] = true;
  }
  if (w.gtag) w.gtag('consent', 'update', { analytics_storage: 'denied' });
  deleteGaCookies(win.document);
}
