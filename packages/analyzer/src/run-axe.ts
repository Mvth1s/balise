import { AxeBuilder } from '@axe-core/playwright';
import axe from 'axe-core';
import type { AxeResults, NodeResult, Result } from 'axe-core';
import type { Page } from 'playwright-core';
import type { NormalizedRuleResult } from './results.js';
import type { FindingNode } from './types.js';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;
export const AXE_VERSION: string = axe.version;

const KNOWN_AXE_RULES = new Set(axe.getRules().map((r) => r.ruleId));
const AXE_DOC_VERSION = AXE_VERSION.split('.').slice(0, 2).join('.');

/**
 * Documentation link rebuilt in Node from the rule id: axe results come back
 * from the analysed page, whose scripts could tamper with them.
 */
export function axeHelpUrl(rule: string): string | undefined {
  return KNOWN_AXE_RULES.has(rule)
    ? `https://dequeuniversity.com/rules/axe/${AXE_DOC_VERSION}/${rule}?application=playwright`
    : undefined;
}

/** Builds axe run options: WCAG tags + every mapped axe rule (even outside those tags). */
export function buildAxeOptions(mappedAxeRules: readonly string[]): axe.RunOptions {
  const rules: Record<string, { enabled: boolean }> = {};
  for (const rule of mappedAxeRules) {
    if (KNOWN_AXE_RULES.has(rule)) rules[rule] = { enabled: true };
  }
  return { runOnly: { type: 'tag', values: [...AXE_TAGS] }, rules };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Untrusted input (see axeHelpUrl): every type is checked. */
function targetToSelector(target: unknown): string {
  if (!Array.isArray(target)) return '';
  return target
    .map((t: unknown) => (Array.isArray(t) ? t.map(str).join(' ') : str(t)))
    .join(' >>> ');
}

function toNode(node: NodeResult): FindingNode {
  return { selector: targetToSelector(node?.target), html: str(node?.html) };
}

const nodesOf = (r: Result | undefined): NodeResult[] =>
  Array.isArray(r?.nodes) ? (r.nodes as NodeResult[]) : [];

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
    for (const r of Array.isArray(list) ? list : []) {
      if (typeof r?.id !== 'string') continue;
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
    const failures = nodesOf(e.violations).map(toNode);
    const passedCount = nodesOf(e.passes).length;
    const incompleteCount = nodesOf(e.incomplete).length;
    const outcome =
      failures.length > 0
        ? 'fail'
        : incompleteCount > 0
          ? 'incomplete'
          : passedCount > 0
            ? 'pass'
            : 'inapplicable';
    const helpUrl = axeHelpUrl(rule);
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
