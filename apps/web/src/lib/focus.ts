/** Moves focus to an element that is not natively focusable (tabindex -1). */
export function focusElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: false });
  return document.activeElement === el;
}

/** Focuses the page <h1> (or <main> when there is none) after a route change. */
export function focusMainHeading(doc: Document = document): boolean {
  const main = doc.getElementById('contenu');
  const heading = main?.querySelector<HTMLElement>('h1') ?? null;
  return focusElement(heading ?? main);
}

/** Focuses the element targeted by a URL hash ("#methode"); false when absent. */
export function focusHashTarget(hash: string, doc: Document = document): boolean {
  let id = hash.replace(/^#/, '');
  try {
    id = decodeURIComponent(id);
  } catch {
    /* keep the raw id */
  }
  return id ? focusElement(doc.getElementById(id)) : false;
}
