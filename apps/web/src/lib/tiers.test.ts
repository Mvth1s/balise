import { describe, expect, it } from 'vitest';
import {
  coverageLabel,
  gaugeAccessibleName,
  globalCoverageLabel,
  tierFor,
  tierInfo,
} from './tiers';

const value = (score: number | null, tested: number, total: number) => ({
  score,
  tier: null,
  tested,
  total,
  conformes: 0,
  nonConformes: 0,
});

describe('tiers', () => {
  it('maps scores to tiers at the documented thresholds', () => {
    expect([100, 90, 89, 50, 49, 0, null].map(tierFor)).toEqual([
      'good',
      'good',
      'warn',
      'warn',
      'bad',
      'bad',
      'manual',
    ]);
  });

  it('always pairs a tier with an icon and a label', () => {
    for (const s of [95, 70, 10, null]) {
      const info = tierInfo(s);
      expect(info.icon).toBeTruthy();
      expect(info.label).toBeTruthy();
    }
    expect(tierInfo(null).label).toBe('Non évaluable');
  });

  it('builds coverage labels and full gauge names', () => {
    expect(coverageLabel(value(50, 1, 9))).toBe('1 critère testé');
    expect(coverageLabel(value(null, 0, 9))).toBe('Aucun critère testé automatiquement');
    expect(globalCoverageLabel(value(69, 32, 106))).toBe(
      '32 critères testés automatiquement sur 106',
    );
    expect(gaugeAccessibleName('Images', value(78, 4, 9))).toBe(
      'Images : 78 sur 100, palier À corriger, 4 critères testés sur 9',
    );
    expect(gaugeAccessibleName('Multimédia', value(null, 0, 13))).toBe(
      'Multimédia : non évaluable, aucun critère testé automatiquement sur 13',
    );
  });
});
