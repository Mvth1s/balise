/// <reference lib="dom" />
import type { CheckResult, DescribeFn } from './types.js';

export const SKIP_LINK_RULE = 'balise-skip-link';

/**
 * RGAA 12.7: a skip link to the main content is present. Looks among the
 * first focusable elements for an in-page link whose target exists.
 * No focusable element → inapplicable. Self-contained.
 */
export function checkSkipLink(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-skip-link';
  const MAX_POSITION = 5;
  const focusable = Array.from(
    doc.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'),
  ).filter((el) => {
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && Number(tabindex) < 0) return false;
    if (el.hasAttribute('disabled')) return false;
    return !(el as HTMLInputElement).type || (el as HTMLInputElement).type !== 'hidden';
  });
  if (focusable.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const candidates = focusable.slice(0, MAX_POSITION);
  let brokenLink: Element | null = null;
  for (const el of candidates) {
    if (el.tagName.toLowerCase() !== 'a') continue;
    const href = el.getAttribute('href') ?? '';
    if (!href.startsWith('#') || href.length < 2) continue;
    let id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // keep raw fragment
    }
    const target = doc.getElementById(id) ?? doc.getElementsByName(id)[0] ?? null;
    if (target) return { rule, outcome: 'pass', nodes: [describe(el)] };
    brokenLink ??= el;
  }
  if (brokenLink) return { rule, outcome: 'fail', nodes: [describe(brokenLink)] };
  const body = describe(doc.body ?? doc.documentElement);
  const openingTag = body.html.slice(0, body.html.indexOf('>') + 1) || body.html;
  return { rule, outcome: 'fail', nodes: [{ selector: body.selector, html: openingTag }] };
}
