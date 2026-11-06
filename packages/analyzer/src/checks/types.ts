/// <reference lib="dom" />
import type { FindingNode } from '../types.js';

export type CheckOutcome = 'pass' | 'fail' | 'inapplicable' | 'incomplete';

export interface CheckResult {
  rule: string;
  outcome: CheckOutcome;
  nodes: FindingNode[];
}

/** Serialises an element as {selector, html}. Must be self-contained (runs in the page). */
export type DescribeFn = (el: Element) => FindingNode;

/**
 * A check runs inside the analysed page. It MUST be self-contained: it is
 * serialised with `Function.prototype.toString` and receives its helpers as
 * arguments (no closure, no import).
 */
export type CheckFn = (doc: Document, describe: DescribeFn) => CheckResult;
