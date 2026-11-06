import { isHydrated } from './hydration';
import { motionAllowed } from './motion';

/**
 * Small animation helpers (Web Animations API, no library). Durations 150-400 ms,
 * ease-out, transform/opacity (plus stroke drawing for gauges and check marks).
 * Every helper is a no-op when animations are disabled.
 */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function canAnimate(el?: Element | null): boolean {
  if (!motionAllowed() || !isHydrated()) return false;
  return !el || typeof (el as HTMLElement).animate === 'function';
}

/** Fades and lifts an element in, with an optional delay (cascades). */
export function enter(el: Element, delay = 0, duration = 320): Animation | null {
  if (!canAnimate(el)) return null;
  return el.animate(
    [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration, delay, easing: EASE_OUT, fill: 'backwards' },
  );
}

/** Opacity-only fade (used where movement is not wanted). */
export function fadeIn(el: Element, duration = 200): Animation | null {
  if (!canAnimate(el)) return null;
  return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE_OUT });
}

/** Draws an SVG path (check mark) by animating its dash offset. */
export function drawStroke(path: SVGGeometryElement, duration = 300, delay = 0) {
  if (!canAnimate(path)) return null;
  const length = path.getTotalLength?.() ?? 0;
  if (!length) return null;
  return path.animate(
    [
      { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
      { strokeDasharray: `${length}`, strokeDashoffset: '0' },
    ],
    { duration, delay, easing: EASE_OUT, fill: 'backwards' },
  );
}

/**
 * Counts from `from` to `to`, calling `update` on each frame.
 * Returns a cancel function. Calls update(to) immediately when disabled.
 */
export function countUp(
  from: number,
  to: number,
  duration: number,
  update: (value: number) => void,
): () => void {
  if (!canAnimate() || typeof requestAnimationFrame !== 'function' || from === to) {
    update(to);
    return () => undefined;
  }
  let frame = 0;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    update(Math.round(from + (to - from) * eased));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
