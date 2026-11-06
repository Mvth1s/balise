import { AxeBuilder } from '@axe-core/playwright';
import axe from 'axe-core';
import type { AxeResults, NodeResult, Result } from 'axe-core';
import type { Page } from 'playwright-core';
import type { NormalizedRuleResult } from './results.js';
import type { FindingNode } from './types.js';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;
export const AXE_VERSION: string = axe.version;

const KNOWN_AXE_RULES = new Set(axe.getRules().map((r) => r.ruleId));

/** Builds axe run options: WCAG tags + every mapped axe rule (even outside those tags). */
export function buildAxeOptions(mappedAxeRules: readonly string[]): axe.RunOptions {
  const rules: Record<string, { enabled: boolean }> = {};
  for (const rule of mappedAxeRules) {
    if (KNOWN_AXE_RULES.has(rule)) rules[rule] = { enabled: true };
  }
  return { runOnly: { type: 'tag', values: [...AXE_TAGS] }, rules };
}

function targetToSelector(target: NodeResult['target']): string {
  return target.map((t) => (Array.isArray(t) ? t.join(' ') : String(t))).join(' >>> ');
}

function toNode(node: NodeResult): FindingNode {
  return {
    selector: targetToSelector(node.target),
    html: typeof node.html === 'string' ? node.html : '',
  };
}

/** Converts axe results into one normalized result per rule. */
export function normalizeAxeResults(
  results: Pick<AxeResults, 'violations' | 'passes' | 'incomplete' | 'inapplicable'>,
): NormalizedRuleResult[] {
  const byRule = new Map<
    string,
    { violations?: Result; passes?: Result; incomplete?: Result; inapplicable?: Result }
  >();
  const add = (
    kind: 'violations' | 'passes' | 'incomplete' | 'inapplicable',
    list: Result[],
  ): void => {
    for (const r of list) {
      const entry = byRule.get(r.id) ?? {};
      entry[kind] = r;
      byRule.set(r.id, entry);
    }
  };
  add('violations', results.violations);
  add('passes', results.passes);
  add('incomplete', results.incomplete);
  add('inapplicable', results.inapplicable);

  const out: NormalizedRuleResult[] = [];
  for (const [rule, e] of byRule) {
    const failures = (e.violations?.nodes ?? []).map(toNode);
    const passedCount = e.passes?.nodes.length ?? 0;
    const incompleteCount = e.incomplete?.nodes.length ?? 0;
    const outcome =
      failures.length > 0
        ? 'fail'
        : incompleteCount > 0
          ? 'incomplete'
          : passedCount > 0
            ? 'pass'
            : 'inapplicable';
    const helpUrl = (e.violations ?? e.passes ?? e.incomplete ?? e.inapplicable)?.helpUrl;
    out.push({
      rule,
      engine: 'axe',
      outcome,
      failures,
      passedCount,
      ...(helpUrl ? { helpUrl } : {}),
    });
  }
  return out;
}

/** Runs axe-core on the rendered page. */
export async function runAxe(
  page: Page,
  mappedAxeRules: readonly string[],
): Promise<NormalizedRuleResult[]> {
  const results = await new AxeBuilder({ page }).options(buildAxeOptions(mappedAxeRules)).analyze();
  return normalizeAxeResults(results);
}
