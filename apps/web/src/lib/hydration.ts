/**
 * True once the root component is mounted. Components rendered during the
 * initial hydration of a pre-rendered page must not animate (no flash, no
 * mismatch); components mounted later (client navigation, live report) may.
 */
let hydrated = false;

export function markHydrated(): void {
  hydrated = true;
}

export function isHydrated(): boolean {
  return hydrated;
}
