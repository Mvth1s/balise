import { readItem, writeItem } from './storage';

/**
 * Animation preference. <html data-motion="on|off"> is the effective state:
 * "on" only when the user switch is on AND the system does not ask for
 * reduced motion. Set before the first paint by public/theme-init.js.
 */
export const MOTION_KEY = 'balise:motion';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

export function systemReducesMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia(REDUCE_QUERY).matches;
  } catch {
    return false;
  }
}

/** The user switch (independent from the system setting). */
export function readMotionSwitch(): boolean {
  return readItem(MOTION_KEY) !== 'off';
}

export function saveMotionSwitch(on: boolean): void {
  writeItem(MOTION_KEY, on ? 'on' : 'off');
}

export function applyMotion(switchOn: boolean, root: HTMLElement = document.documentElement) {
  root.setAttribute('data-motion', switchOn && !systemReducesMotion() ? 'on' : 'off');
}

/** True when animations may run now. Always false during SSR. */
export function motionAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-motion') === 'on' && !systemReducesMotion();
}

/** Calls back when the system preference changes. Returns an unsubscribe function. */
export function onSystemMotionChange(cb: () => void): () => void {
  try {
    const mq = window.matchMedia(REDUCE_QUERY);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  } catch {
    return () => undefined;
  }
}
