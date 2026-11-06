import { reactive, readonly } from 'vue';
import {
  applyMotion,
  onSystemMotionChange,
  readMotionSwitch,
  saveMotionSwitch,
  systemReducesMotion,
} from '@/lib/motion';
import {
  applyTheme,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/lib/theme';

interface PreferencesState {
  ready: boolean;
  theme: ThemePreference;
  motion: boolean;
  systemReduce: boolean;
}

const state = reactive<PreferencesState>({
  ready: false,
  theme: 'system',
  motion: true,
  systemReduce: false,
});

let unsubscribe: (() => void) | null = null;

/** Reads the saved preferences (client only, after mount). */
export function initPreferences(): void {
  state.theme = readThemePreference();
  state.motion = readMotionSwitch();
  state.systemReduce = systemReducesMotion();
  applyMotion(state.motion);
  unsubscribe?.();
  unsubscribe = onSystemMotionChange(() => {
    state.systemReduce = systemReducesMotion();
    applyMotion(state.motion);
  });
  state.ready = true;
}

export function setTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  const fade = root.getAttribute('data-motion') === 'on';
  if (fade) root.classList.add('theme-fading');
  state.theme = theme;
  applyTheme(theme);
  saveThemePreference(theme);
  if (fade) window.setTimeout(() => root.classList.remove('theme-fading'), 250);
}

export function setMotion(on: boolean): void {
  state.motion = on;
  saveMotionSwitch(on);
  applyMotion(on);
}

export function usePreferences() {
  return { state: readonly(state), setTheme, setMotion };
}
