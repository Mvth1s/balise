import type { CheckResult } from './checks/types.js';
import type { FindingNode } from './types.js';

export type RuleOutcome = 'fail' | 'pass' | 'incomplete' | 'inapplicable';

/** Engine-agnostic result of one rule on the page. */
export interface NormalizedRuleResult {
  rule: string;
  engine: 'axe' | 'balise';
  /** Aggregated outcome: fail > incomplete > pass > inapplicable. */
  outcome: RuleOutcome;
  /** Failing elements (outcome fail), raw strings from the page. */
  failures: FindingNode[];
  /** Number of elements on which the rule passed. */
  passedCount: number;
  helpUrl?: string;
}

/** Converts a custom check result into a normalized result. */
export function normalizeCheckResult(result: CheckResult): NormalizedRuleResult {
  return {
    rule: result.rule,
    engine: 'balise',
    outcome: result.outcome,
    failures: result.outcome === 'fail' ? result.nodes : [],
    passedCount: result.outcome === 'pass' ? Math.max(1, result.nodes.length) : 0,
  };
}
