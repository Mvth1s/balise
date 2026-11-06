import { rulesForCriterion, type RgaaReference, type RuleMapping } from '@balise/rgaa-mapping';
import type { NormalizedRuleResult } from './results.js';
import type { CriterionResult, CriterionStatus, Finding, FindingNode } from './types.js';

export const MAX_NODES_PER_FINDING = 20;
export const MAX_HTML_LENGTH = 500;

export function truncateHtml(html: string, max: number = MAX_HTML_LENGTH): string {
  return html.length > max ? `${html.slice(0, max)}…` : html;
}

function toFinding(mapping: RuleMapping, result: NormalizedRuleResult): Finding {
  const nodes: FindingNode[] = result.failures
    .slice(0, MAX_NODES_PER_FINDING)
    .map((n) => ({ selector: n.selector, html: truncateHtml(n.html) }));
  return {
    rule: mapping.rule,
    engine: mapping.engine,
    explanation: mapping.explanation,
    fix: mapping.fix,
    ...(result.helpUrl ? { helpUrl: result.helpUrl } : {}),
    count: Math.max(result.failures.length, 1),
    nodes,
  };
}

/**
 * Status of one criterion given its mapped rules and the results:
 * - non-conforme: a mapped rule failed;
 * - conforme: at least one `full` rule passed on elements, no mapped rule is
 *   incomplete, and every `full` mapped rule was evaluated;
 * - non-applicable: every mapped rule was evaluated and is inapplicable, and
 *   at least one is `full`;
 * - a-verifier: everything else (including criteria without rules).
 */
export function criterionStatus(
  mappings: readonly RuleMapping[],
  results: ReadonlyMap<string, NormalizedRuleResult>,
): CriterionStatus {
  if (mappings.length === 0) return 'a-verifier';
  const outcomes = mappings.map((m) => ({ m, r: results.get(m.rule) }));
  if (outcomes.some(({ r }) => r?.outcome === 'fail')) return 'non-conforme';
  const full = outcomes.filter(({ m }) => m.coverage === 'full');
  const anyIncomplete = outcomes.some(({ r }) => r?.outcome === 'incomplete');
  const allFullEvaluated = full.every(({ r }) => r !== undefined);
  const fullPassed = full.some(({ r }) => r?.outcome === 'pass' && r.passedCount > 0);
  if (fullPassed && !anyIncomplete && allFullEvaluated) return 'conforme';
  if (full.length > 0 && outcomes.every(({ r }) => r?.outcome === 'inapplicable'))
    return 'non-applicable';
  return 'a-verifier';
}

/** Maps normalized rule results onto EVERY criterion of the reference. */
export function mapResults(
  ref: RgaaReference,
  results: readonly NormalizedRuleResult[],
): CriterionResult[] {
  const byRule = new Map<string, NormalizedRuleResult>();
  for (const r of results) byRule.set(r.rule, r);
  return ref.criteria.map((criterion) => {
    const mappings = rulesForCriterion(ref, criterion.id);
    const status = criterionStatus(mappings, byRule);
    const findings: Finding[] =
      status === 'non-conforme'
        ? mappings.flatMap((m) => {
            const r = byRule.get(m.rule);
            return r?.outcome === 'fail' ? [toFinding(m, r)] : [];
          })
        : [];
    return {
      id: criterion.id,
      theme: criterion.theme,
      title: criterion.title,
      url: criterion.url,
      status,
      rules: mappings.filter((m) => byRule.has(m.rule)).map((m) => m.rule),
      findings,
    };
  });
}

/** Rule ids mapped for a given engine (used to force-run mapped axe rules). */
export function mappedRules(ref: RgaaReference, engine: 'axe' | 'balise'): string[] {
  return [...new Set(ref.rules.filter((r) => r.engine === engine).map((r) => r.rule))];
}
