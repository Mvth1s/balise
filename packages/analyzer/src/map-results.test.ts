import { getReference, type RgaaReference, type RuleMapping } from '@balise/rgaa-mapping';
import { describe, expect, it } from 'vitest';
import { BALISE_RULES } from './checks/index.js';
import { INTERACTION_RULES } from './interactions.js';
import {
  criterionStatus,
  mappedRules,
  mapResults,
  MAX_NODES_PER_FINDING,
  truncateHtml,
} from './map-results.js';
import { normalizeCheckResult, type NormalizedRuleResult } from './results.js';
import { buildAxeOptions, normalizeAxeResults } from './run-axe.js';

const source = { url: 'https://x', retrieved: '2026-11-05' };
const m = (
  rule: string,
  coverage: 'full' | 'partial' = 'full',
  criteria = ['1.1'],
): RuleMapping => ({
  rule,
  engine: rule.startsWith('balise-') ? 'balise' : 'axe',
  criteria,
  coverage,
  rationale: 'r',
  explanation: `Explication ${rule}`,
  fix: `Correction ${rule}`,
  source,
});
const r = (
  rule: string,
  outcome: NormalizedRuleResult['outcome'],
  extra: Partial<NormalizedRuleResult> = {},
): NormalizedRuleResult => ({
  rule,
  engine: 'axe',
  outcome,
  failures: outcome === 'fail' ? [{ selector: 'img', html: '<img>' }] : [],
  passedCount: outcome === 'pass' ? 1 : 0,
  ...extra,
});
const results = (...list: NormalizedRuleResult[]) => new Map(list.map((x) => [x.rule, x]));

describe('criterionStatus', () => {
  it('is a-verifier without mapped rules', () => {
    expect(criterionStatus([], results())).toBe('a-verifier');
  });
  it('is non-conforme as soon as one mapped rule fails, whatever its coverage', () => {
    expect(
      criterionStatus([m('a'), m('b', 'partial')], results(r('a', 'pass'), r('b', 'fail'))),
    ).toBe('non-conforme');
  });
  it('is conforme only when full rules passed, all were evaluated and nothing is incomplete', () => {
    expect(
      criterionStatus([m('a'), m('b', 'partial')], results(r('a', 'pass'), r('b', 'pass'))),
    ).toBe('conforme');
    expect(criterionStatus([m('a'), m('b')], results(r('a', 'pass')))).toBe('a-verifier');
    expect(
      criterionStatus([m('a'), m('b', 'partial')], results(r('a', 'pass'), r('b', 'incomplete'))),
    ).toBe('a-verifier');
    expect(criterionStatus([m('a')], results(r('a', 'pass', { passedCount: 0 })))).toBe(
      'a-verifier',
    );
    expect(criterionStatus([m('a', 'partial')], results(r('a', 'pass')))).toBe('a-verifier');
  });
  it('is non-applicable when every rule is inapplicable and one is full', () => {
    expect(
      criterionStatus(
        [m('a'), m('b', 'partial')],
        results(r('a', 'inapplicable'), r('b', 'inapplicable')),
      ),
    ).toBe('non-applicable');
    expect(criterionStatus([m('a', 'partial')], results(r('a', 'inapplicable')))).toBe(
      'a-verifier',
    );
  });
});

describe('mapResults', () => {
  const ref: RgaaReference = {
    version: 't',
    name: 'T',
    sources: [source],
    themes: [{ number: 1, title: 'Images' }],
    criteria: [
      { id: '1.1', theme: 1, title: 'C1', url: 'https://x/#1.1' },
      { id: '1.2', theme: 1, title: 'C2', url: 'https://x/#1.2' },
    ],
    rules: [m('image-alt'), m('balise-x', 'partial'), m('role-img-alt', 'full', ['1.2'])],
  };

  it('returns every criterion with findings for failures only', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      selector: `#i${i}${' p'.repeat(i === 0 ? 600 : 0)}`,
      html: 'x'.repeat(600),
    }));
    const out = mapResults(ref, [
      r('image-alt', 'fail', { failures: many, helpUrl: 'https://help' }),
      r('balise-x', 'pass'),
      r('unmapped', 'fail'),
    ]);
    expect(out.map((c) => [c.id, c.status])).toEqual([
      ['1.1', 'non-conforme'],
      ['1.2', 'a-verifier'],
    ]);
    const [finding] = out[0]!.findings;
    expect(finding).toMatchObject({
      rule: 'image-alt',
      engine: 'axe',
      count: 30,
      helpUrl: 'https://help',
      explanation: 'Explication image-alt',
    });
    expect(finding!.nodes).toHaveLength(MAX_NODES_PER_FINDING);
    expect(finding!.nodes[0]!.html).toHaveLength(501);
    expect(finding!.nodes[0]!.selector).toHaveLength(1001);
    expect(out[0]!.rules).toEqual(['image-alt', 'balise-x']);
    expect(out[1]!.findings).toEqual([]);
    expect(out[1]!.rules).toEqual([]);
  });

  it('lists mapped rules per engine without duplicates', () => {
    expect(mappedRules(ref, 'axe')).toEqual(['image-alt', 'role-img-alt']);
    expect(mappedRules(ref, 'balise')).toEqual(['balise-x']);
  });

  it('truncates HTML', () => {
    expect(truncateHtml('abc', 2)).toBe('ab…');
    expect(truncateHtml('abc')).toBe('abc');
  });
});

describe('RGAA 4.1.2 reference wiring', () => {
  const ref = getReference();
  it('maps every rule to an existing criterion and runs every Balise check', () => {
    const ids = new Set(ref.criteria.map((c) => c.id));
    for (const rule of ref.rules)
      for (const id of rule.criteria) expect(ids.has(id), `${rule.rule} → ${id}`).toBe(true);
    expect(mappedRules(ref, 'balise').sort()).toEqual(
      [...new Set([...BALISE_RULES, ...INTERACTION_RULES])].sort(),
    );
  });
  it('produces one result per criterion (106)', () => {
    expect(mapResults(ref, [])).toHaveLength(106);
  });
});

describe('result normalisation', () => {
  it('normalises custom checks', () => {
    const node = { selector: 'h3', html: '<h3>' };
    expect(normalizeCheckResult({ rule: 'x', outcome: 'fail', nodes: [node] })).toMatchObject({
      failures: [node],
      passedCount: 0,
      engine: 'balise',
    });
    expect(normalizeCheckResult({ rule: 'x', outcome: 'pass', nodes: [] }).passedCount).toBe(1);
    expect(
      normalizeCheckResult({ rule: 'x', outcome: 'inapplicable', nodes: [node] }).failures,
    ).toEqual([]);
  });

  it('normalises axe results with priority fail > incomplete > pass > inapplicable', () => {
    // The page may tamper with axe results: helpUrl is ignored, types are checked.
    const res = (id: unknown, nodes: unknown = [], helpUrl = 'javascript:alert(1)') =>
      ({ id, helpUrl, nodes }) as never;
    const node = (target: unknown[], html: unknown = '<x>') => ({ target, html });
    const out = normalizeAxeResults({
      violations: [
        res('image-alt', [
          node(['#a', ['iframe', '#b']]),
          node(['img'], null),
          { target: 'x', html: 3 },
          null,
        ]),
        res(42),
      ],
      passes: [
        res('image-alt', [node(['p'])]),
        res('b', [node(['p'])]),
        res('c', [node(['p'])]),
        res('e', 'not an array'),
      ],
      incomplete: [res('c', [node(['p'])])],
      inapplicable: [res('d', [], '')],
    });
    const byRule = Object.fromEntries(out.map((x) => [x.rule, x]));
    expect(byRule['image-alt']).toMatchObject({
      outcome: 'fail',
      passedCount: 1,
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/image-alt?application=playwright',
    });
    expect(byRule['image-alt']!.failures).toEqual([
      { selector: '#a >>> iframe #b', html: '<x>' },
      { selector: 'img', html: '' },
      { selector: '', html: '' },
      { selector: '', html: '' },
    ]);
    expect(out.map((x) => x.rule)).not.toContain(42);
    expect(byRule.e!.outcome).toBe('inapplicable');
    expect(byRule.b).not.toHaveProperty('helpUrl');
    expect(byRule.b!.outcome).toBe('pass');
    expect(byRule.c!.outcome).toBe('incomplete');
    expect(byRule.d!.outcome).toBe('inapplicable');
    expect(byRule.d).not.toHaveProperty('helpUrl');
  });

  it('enables mapped axe rules outside the WCAG tags, ignoring unknown ids', () => {
    const options = buildAxeOptions(['region', 'nope']);
    expect(options.rules).toEqual({ region: { enabled: true } });
    expect(options.runOnly).toMatchObject({ type: 'tag' });
  });
});
