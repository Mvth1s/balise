import { describe, expect, it } from 'vitest';
import {
  CONSENT_KEY,
  GA_COOKIE_EXPIRES,
  loadAnalytics,
  readConsent,
  writeConsent,
} from './analytics';
import { loadChecklist, saveChecklist, toggleItem } from './checklist';
import type { KeyValueStorage } from './storage';

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('consent storage', () => {
  it('keeps the choice 6 months, then forgets it', () => {
    const store = memory();
    writeConsent('granted', store, new Date('2026-01-10T00:00:00Z'));
    expect(readConsent(store, new Date('2026-07-09T00:00:00Z'))).toBe('granted');
    expect(readConsent(store, new Date('2026-07-11T00:00:00Z'))).toBeNull();
    expect(store.data.has(CONSENT_KEY)).toBe(false);
  });

  it('ignores invalid stored values', () => {
    const store = memory();
    store.setItem(CONSENT_KEY, '{"value":"yes","date":"2026-01-01"}');
    expect(readConsent(store)).toBeNull();
    store.setItem(CONSENT_KEY, 'not json');
    expect(readConsent(store)).toBeNull();
  });
});

describe('GA4 loading', () => {
  it('configures GA4 without signals nor ad personalisation, cookies ≤ 13 months', () => {
    expect(loadAnalytics('G-TEST1234')).toBe(true);
    const layer = (window as unknown as { dataLayer: IArguments[] }).dataLayer.map((a) => [...a]);
    const config = layer.find((a) => a[0] === 'config');
    expect(config?.[2]).toMatchObject({
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    expect(GA_COOKIE_EXPIRES).toBeLessThanOrEqual(13 * 31 * 24 * 3600);
    expect(layer.find((a) => a[0] === 'consent' && a[1] === 'default')?.[2]).toMatchObject({
      analytics_storage: 'denied',
    });
    expect(loadAnalytics('pas-un-id')).toBe(false);
  });
});

describe('checklist', () => {
  it('round-trips checked items', () => {
    const store = memory();
    const checked = toggleItem(toggleItem(new Set(), '1.3', true), '6.1', true);
    saveChecklist('r1', toggleItem(checked, '1.3', false), store);
    expect([...loadChecklist('r1', store)]).toEqual(['6.1']);
    expect(loadChecklist('autre', store).size).toBe(0);
  });
});
