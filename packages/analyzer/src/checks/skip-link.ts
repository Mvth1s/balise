/// <reference lib="dom" />
import type { CheckResult, DescribeFn } from './types.js';

export const SKIP_LINK_RULE = 'balise-skip-link';

/**
 * RGAA 12.7: a skip link to the main content is present. Looks among the
 * first focusable elements for an in-page link whose target exists, then
 * fails on any quick-access link ("Aller au…", "Skip to…") anywhere in the
 * page whose target is missing (test 12.7.1: the link must work).
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
  // null: not an in-page link; true/false: its target exists.
  const targetExists = (el: Element): boolean | null => {
    if (el.tagName.toLowerCase() !== 'a') return null;
    const href = el.getAttribute('href') ?? '';
    if (!href.startsWith('#') || href.length < 2) return null;
    let id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // keep raw fragment
    }
    return (doc.getElementById(id) ?? doc.getElementsByName(id)[0] ?? null) !== null;
  };
  let brokenLink: Element | null = null;
  let skipLink: Element | null = null;
  for (const el of candidates) {
    const exists = targetExists(el);
    if (exists === true) {
      skipLink = el;
      break;
    }
    if (exists === false) brokenLink ??= el;
  }
  if (skipLink) {
    const QUICK_ACCESS = /^(aller|passer|acc[eé]der|sauter|retour|skip|jump|go) /i;
    const brokenQuick = focusable.find(
      (el) =>
        targetExists(el) === false &&
        QUICK_ACCESS.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
    );
    if (brokenQuick) return { rule, outcome: 'fail', nodes: [describe(brokenQuick)] };
    return { rule, outcome: 'pass', nodes: [describe(skipLink)] };
  }
  if (brokenLink) return { rule, outcome: 'fail', nodes: [describe(brokenLink)] };
  const body = describe(doc.body ?? doc.documentElement);
  const openingTag = body.html.slice(0, body.html.indexOf('>') + 1) || body.html;
  return { rule, outcome: 'fail', nodes: [{ selector: body.selector, html: openingTag }] };
}
