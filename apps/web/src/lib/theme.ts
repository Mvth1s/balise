import { readItem, removeItem, writeItem } from './storage';

/** Keys and values shared with public/theme-init.js. */
export const THEME_KEY = 'balise:theme';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Selon le système',
  light: 'Clair',
  dark: 'Sombre',
};

export function readThemePreference(): ThemePreference {
  const v = readItem(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function applyTheme(pref: ThemePreference, root: HTMLElement = document.documentElement) {
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function saveThemePreference(pref: ThemePreference): void {
  if (pref === 'system') removeItem(THEME_KEY);
  else writeItem(THEME_KEY, pref);
}
