import { describe, expect, it } from 'vitest';
import {
  computeScores,
  globalScore,
  ratioScore,
  themeScore,
  tierFor,
  type ScoringConfig,
} from './scoring.js';
import type { CriterionStatus } from './types.js';

const c = (theme: number, status: CriterionStatus) => ({ theme, status });

describe('tierFor', () => {
  it('uses the 90 / 50 thresholds and keeps null', () => {
    expect([100, 90, 89, 50, 49, 0].map((s) => tierFor(s))).toEqual([
      'good',
      'good',
      'warn',
      'warn',
      'bad',
      'bad',
    ]);
    expect(tierFor(null)).toBeNull();
    expect(tierFor(Number.NaN)).toBeNull();
  });
});

describe('ratioScore', () => {
  it('is 100 × C / (C + NC), rounded, null when nothing was tested', () => {
    expect(ratioScore(3, 1)).toBe(75);
    expect(ratioScore(2, 1)).toBe(67);
    expect(ratioScore(0, 4)).toBe(0);
    expect(ratioScore(0, 0)).toBeNull();
  });
});

describe('themeScore', () => {
  it('ignores manual and non-applicable criteria and other themes', () => {
    const criteria = [
      c(1, 'conforme'),
      c(1, 'non-conforme'),
      c(1, 'a-verifier'),
      c(1, 'non-applicable'),
      c(2, 'conforme'),
    ];
    expect(themeScore({ number: 1, title: 'Images' }, criteria)).toEqual({
      theme: 1,
      title: 'Images',
      score: 50,
      tier: 'warn',
      conformes: 1,
      nonConformes: 1,
      tested: 2,
      total: 4,
    });
  });

  it('is « Non évaluable » (null), never 100, without tested criteria', () => {
    const t = themeScore({ number: 3, title: 'Couleurs' }, [
      c(3, 'a-verifier'),
      c(3, 'non-applicable'),
    ]);
    expect(t.score).toBeNull();
    expect(t.tier).toBeNull();
    expect(t.tested).toBe(0);
  });
});

describe('globalScore / computeScores', () => {
  it('weights theme scores by tested criteria', () => {
    // Theme 1: 4 tested, 100. Theme 2: 1 tested, 0. → (100×4 + 0×1) / 5 = 80.
    const criteria = [
      ...Array.from({ length: 4 }, () => c(1, 'conforme')),
      c(2, 'non-conforme'),
      c(3, 'a-verifier'),
    ];
    const scores = computeScores(
      [
        { number: 3, title: 'C' },
        { number: 1, title: 'A' },
        { number: 2, title: 'B' },
      ],
      criteria,
    );
    expect(scores.themes.map((t) => [t.theme, t.score])).toEqual([
      [1, 100],
      [2, 0],
      [3, null],
    ]);
    expect(scores.global).toEqual({
      score: 80,
      tier: 'warn',
      conformes: 4,
      nonConformes: 1,
      tested: 5,
      total: 6,
    });
  });

  it('applies configured theme weights (missing weight = 1)', () => {
    const config: ScoringConfig = { weights: { '2': 4 }, tiers: { good: 90, warn: 50 } };
    const criteria = [c(1, 'conforme'), c(2, 'non-conforme')];
    const themes = [
      themeScore({ number: 1, title: 'A' }, criteria, config),
      themeScore({ number: 2, title: 'B' }, criteria, config),
    ];
    expect(globalScore(themes, criteria, config).score).toBe(20);
  });

  it('is null when nothing was tested', () => {
    const scores = computeScores([{ number: 1, title: 'A' }], [c(1, 'a-verifier')]);
    expect(scores.global.score).toBeNull();
    expect(scores.global.tier).toBeNull();
  });
});
