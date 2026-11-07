import type { CriterionResult } from '@balise/analyzer/types';
import { describe, expect, it } from 'vitest';
import { DEMO_REPORTS } from './demo-reports';
import {
  compareCriterionIds,
  countByStatus,
  exportFileName,
  filterCriteria,
  priorityFixes,
  safeHref,
} from './report';

const criterion = (
  id: string,
  theme: number,
  status: CriterionResult['status'],
): CriterionResult => ({
  id,
  theme,
  title: '',
  url: '',
  status,
  rules: [],
  findings: [],
});

describe('report helpers', () => {
  it('sorts criterion ids numerically', () => {
    expect(['1.10', '2.1', '1.2'].sort(compareCriterionIds)).toEqual(['1.2', '1.10', '2.1']);
  });

  it('filters by status and theme', () => {
    const list = [
      criterion('1.10', 1, 'non-conforme'),
      criterion('1.2', 1, 'conforme'),
      criterion('3.2', 3, 'non-conforme'),
    ];
    const ids = (statuses: CriterionResult['status'][], theme: number | null) =>
      filterCriteria(list, { statuses: new Set(statuses), theme }).map((c) => c.id);
    expect(ids(['non-conforme'], null)).toEqual(['1.10', '3.2']);
    expect(ids(['non-conforme', 'conforme'], 1)).toEqual(['1.2', '1.10']);
    expect(ids([], null)).toEqual([]);
    expect(countByStatus(list)).toMatchObject({ 'non-conforme': 2, conforme: 1 });
  });

  it('only keeps http(s) links', () => {
    expect(safeHref('https://accessibilite.numerique.gouv.fr/#1.1')).toBe(
      'https://accessibilite.numerique.gouv.fr/#1.1',
    );
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,x')).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });

  it('builds a safe export file name', () => {
    expect(exportFileName({ ...DEMO_REPORTS.avant, id: '../a b' })).toBe('balise-rapport-ab.json');
  });

  it('ships demo reports with 106 criteria and 13 themes', () => {
    for (const report of Object.values(DEMO_REPORTS)) {
      expect(report.schemaVersion).toBe(1);
      expect(report.criteria).toHaveLength(106);
      expect(report.scores.themes).toHaveLength(13);
    }
    expect(DEMO_REPORTS.apres.scores.global.nonConformes).toBe(0);
    expect(DEMO_REPORTS.avant.scores.global.nonConformes).toBeGreaterThan(0);
  });
});

describe('priorityFixes', () => {
  const finding = (fix: string, count: number) =>
    ({ rule: fix, engine: 'axe', explanation: '', fix, count, nodes: [] }) as const;
  const crit = (id: string, status: string, findings: ReturnType<typeof finding>[]) =>
    ({ id, theme: 1, title: id, url: '', status, rules: [], findings }) as never;
  it('keeps the 3 non-compliant criteria with the most elements, one fix each', () => {
    const report = {
      criteria: [
        crit('1.1', 'non-conforme', [finding('a', 1), finding('b', 4)]),
        crit('1.2', 'conforme', []),
        crit('3.2', 'non-conforme', [finding('c', 2)]),
        crit('6.2', 'non-conforme', [finding('d', 9)]),
        crit('8.5', 'non-conforme', [finding('e', 2)]),
      ],
    } as never;
    expect(priorityFixes(report).map((p) => [p.criterion.id, p.fix, p.count])).toEqual([
      ['6.2', 'd', 9],
      ['1.1', 'b', 5],
      ['3.2', 'c', 2],
    ]);
  });
});
