/// <reference lib="dom" />
import type { CheckResult, DescribeFn } from './types.js';

export const PAGE_TITLE_RULE = 'balise-page-title';

/** RGAA 8.5 / 8.6: the page has a non-empty <title>. Self-contained. */
export function checkPageTitle(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-page-title';
  const title = doc.querySelector('head title') ?? doc.querySelector('title');
  if (title && (title.textContent ?? '').replace(/\s+/g, ' ').trim().length > 0) {
    return { rule, outcome: 'pass', nodes: [describe(title)] };
  }
  return { rule, outcome: 'fail', nodes: [describe(title ?? doc.documentElement)] };
}
