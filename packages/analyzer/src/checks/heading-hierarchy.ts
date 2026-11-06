/// <reference lib="dom" />
import type { CheckResult, DescribeFn } from './types.js';

export const HEADING_HIERARCHY_RULE = 'balise-heading-hierarchy';

/**
 * RGAA 9.1: heading levels never skip a level when going deeper
 * (h2 → h4 is a failure). No heading at all → incomplete (manual check).
 * Self-contained.
 */
export function checkHeadingHierarchy(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-heading-hierarchy';
  const isHidden = (el: Element): boolean => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      if (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('hidden')) return true;
      const view = doc.defaultView;
      if (view) {
        const style = view.getComputedStyle(n);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
      }
    }
    return false;
  };
  const levelOf = (el: Element): number => {
    const tag = /^h([1-6])$/i.exec(el.tagName);
    if (el.getAttribute('role') === 'heading') {
      const aria = Number.parseInt(el.getAttribute('aria-level') ?? '', 10);
      if (aria >= 1) return aria;
      return tag ? Number(tag[1]) : 2;
    }
    return tag ? Number(tag[1]) : 0;
  };
  const headings = Array.from(
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'),
  ).filter((el) => !isHidden(el) && levelOf(el) > 0);
  if (headings.length === 0) return { rule, outcome: 'incomplete', nodes: [] };
  const failures: Element[] = [];
  let previous = 0;
  for (const el of headings) {
    const level = levelOf(el);
    if (level > previous + 1 && !(previous === 0 && level === 1)) failures.push(el);
    previous = level;
  }
  if (failures.length > 0)
    return { rule, outcome: 'fail', nodes: failures.map((el) => describe(el)) };
  return { rule, outcome: 'pass', nodes: headings.map((el) => describe(el)) };
}
