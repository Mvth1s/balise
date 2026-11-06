/// <reference lib="dom" />
import type { Page } from 'playwright-core';
import { describeElement } from './describe.js';
import { checkHeadingHierarchy, HEADING_HIERARCHY_RULE } from './heading-hierarchy.js';
import { checkPageLang, PAGE_LANG_RULE } from './page-lang.js';
import { checkPageTitle, PAGE_TITLE_RULE } from './page-title.js';
import { checkSkipLink, SKIP_LINK_RULE } from './skip-link.js';
import type { CheckFn, CheckResult } from './types.js';

export type { CheckFn, CheckOutcome, CheckResult, DescribeFn } from './types.js';
export { describeElement } from './describe.js';
export { checkHeadingHierarchy, checkPageLang, checkPageTitle, checkSkipLink };

/** Frozen ids of the Balise custom checks. */
export const BALISE_RULES = [
  SKIP_LINK_RULE,
  HEADING_HIERARCHY_RULE,
  PAGE_LANG_RULE,
  PAGE_TITLE_RULE,
] as const;
export type BaliseRule = (typeof BALISE_RULES)[number];

export const BALISE_CHECKS: ReadonlyArray<{ rule: BaliseRule; fn: CheckFn }> = [
  { rule: SKIP_LINK_RULE, fn: checkSkipLink },
  { rule: HEADING_HIERARCHY_RULE, fn: checkHeadingHierarchy },
  { rule: PAGE_LANG_RULE, fn: checkPageLang },
  { rule: PAGE_TITLE_RULE, fn: checkPageTitle },
];

/** Builds the expression evaluated in the page for one check. */
export function checkExpression(fn: CheckFn): string {
  return `(${fn.toString()})(document, (${describeElement.toString()}))`;
}

/** Runs one check against a DOM Document (used by unit tests with jsdom). */
export function runCheckOnDocument(fn: CheckFn, doc: Document): CheckResult {
  return fn(doc, describeElement);
}

const OUTCOMES = new Set(['pass', 'fail', 'inapplicable', 'incomplete']);

/**
 * Validates a value returned by the page (untrusted: the page's own scripts
 * may tamper with DOM APIs). Malformed results become `incomplete`.
 */
export function sanitizeCheckResult(rule: string, value: unknown): CheckResult {
  const v = value as Partial<CheckResult> | null;
  if (!v || typeof v !== 'object' || typeof v.outcome !== 'string' || !OUTCOMES.has(v.outcome)) {
    return { rule, outcome: 'incomplete', nodes: [] };
  }
  const nodes = Array.isArray(v.nodes) ? v.nodes : [];
  return {
    rule,
    outcome: v.outcome,
    nodes: nodes
      .filter((n) => n && typeof n.selector === 'string' && typeof n.html === 'string')
      .map((n) => ({ selector: n.selector.slice(0, 1000), html: n.html.slice(0, 1000) })),
  };
}

/** Runs all custom checks in the page. A crashing check yields `incomplete`. */
export async function runChecks(page: Page): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const { rule, fn } of BALISE_CHECKS) {
    try {
      results.push(sanitizeCheckResult(rule, await page.evaluate(checkExpression(fn))));
    } catch {
      results.push({ rule, outcome: 'incomplete', nodes: [] });
    }
  }
  return results;
}
