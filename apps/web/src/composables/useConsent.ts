import { reactive, readonly } from 'vue';
import {
  isValidMeasurementId,
  loadAnalytics,
  readConsent,
  revokeAnalytics,
  trackPageView,
  writeConsent,
  type ConsentValue,
} from '@/lib/analytics';

const measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();

/** GA4 is configured for this build. When false: no GA4 code path, no consent dialog. */
export const analyticsConfigured = isValidMeasurementId(measurementId);

interface ConsentState {
  /** Client initialised (never true during SSR: the dialog is client-only). */
  ready: boolean;
  consent: ConsentValue | null;
  /** Set after a choice made in the dialog, for its live-region announcement. */
  lastChoice: ConsentValue | null;
}

const state = reactive<ConsentState>({ ready: false, consent: null, lastChoice: null });

export function initConsent(): void {
  if (!analyticsConfigured || typeof window === 'undefined') return;
  state.consent = readConsent();
  state.ready = true;
  if (state.consent === 'granted') loadAnalytics(measurementId);
}

export function setConsent(value: ConsentValue, fromDialog = false): void {
  if (!analyticsConfigured) return;
  writeConsent(value);
  state.consent = value;
  if (fromDialog) state.lastChoice = value;
  if (value === 'granted') {
    loadAnalytics(measurementId);
    trackPageView(window.location.pathname, document.title);
  } else {
    revokeAnalytics(measurementId);
  }
}

export function pageView(path: string): void {
  if (analyticsConfigured && state.consent === 'granted') trackPageView(path, document.title);
}

export function useConsent() {
  return { state: readonly(state), analyticsConfigured, setConsent };
}
