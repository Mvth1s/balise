import type { CriterionStatus, ScoreTier, ScoreValue } from '@balise/analyzer/types';

/**
 * Score tiers (kickoff §4): 90-100 good, 50-89 warn, 0-49 bad.
 * Front-end copy of the thresholds; @balise/analyzer/scoring exposes tierFor()
 * once available, the values must stay identical.
 */
export const TIER_GOOD_MIN = 90;
export const TIER_WARN_MIN = 50;

export type DisplayTier = ScoreTier | 'manual';
export type TierIcon = 'check' | 'triangle' | 'cross' | 'eye';

export interface TierInfo {
  tier: DisplayTier;
  label: string;
  icon: TierIcon;
  /** CSS custom property holding the colour. */
  colorVar: string;
}

const TIERS: Record<DisplayTier, TierInfo> = {
  good: { tier: 'good', label: 'Peu d’erreurs', icon: 'check', colorVar: '--color-score-good' },
  warn: { tier: 'warn', label: 'À corriger', icon: 'triangle', colorVar: '--color-score-warn' },
  bad: { tier: 'bad', label: 'Nombreuses erreurs', icon: 'cross', colorVar: '--color-score-bad' },
  manual: {
    tier: 'manual',
    label: 'Non évaluable',
    icon: 'eye',
    colorVar: '--color-score-manual',
  },
};

export function tierFor(score: number | null): DisplayTier {
  if (score === null || !Number.isFinite(score)) return 'manual';
  if (score >= TIER_GOOD_MIN) return 'good';
  if (score >= TIER_WARN_MIN) return 'warn';
  return 'bad';
}

export function tierInfo(score: number | null): TierInfo {
  return TIERS[tierFor(score)];
}

export interface StatusInfo {
  status: CriterionStatus;
  label: string;
  /** Plural label used by the filters. */
  plural: string;
  icon: TierIcon | 'dash';
  colorVar: string;
}

export const STATUS_INFO: Record<CriterionStatus, StatusInfo> = {
  'non-conforme': {
    status: 'non-conforme',
    label: 'Non conforme',
    plural: 'Non conformes',
    icon: 'cross',
    colorVar: '--color-score-bad',
  },
  'a-verifier': {
    status: 'a-verifier',
    label: 'À vérifier manuellement',
    plural: 'À vérifier manuellement',
    icon: 'eye',
    colorVar: '--color-score-manual',
  },
  conforme: {
    status: 'conforme',
    label: 'Conforme, test automatique',
    plural: 'Conformes, test automatique',
    icon: 'check',
    colorVar: '--color-score-good',
  },
  'non-applicable': {
    status: 'non-applicable',
    label: 'Non applicable',
    plural: 'Non applicables',
    icon: 'dash',
    colorVar: '--color-ink-muted',
  },
};

export const STATUS_ORDER: readonly CriterionStatus[] = [
  'non-conforme',
  'a-verifier',
  'conforme',
  'non-applicable',
];

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** "4 critères testés" / "1 critère testé" / "Aucun critère testé". */
export function coverageLabel(value: Pick<ScoreValue, 'tested'>): string {
  if (value.tested === 0) return 'Aucun critère testé automatiquement';
  return plural(value.tested, 'critère testé', 'critères testés');
}

/** "32 critères testés automatiquement sur 106". */
export function globalCoverageLabel(value: Pick<ScoreValue, 'tested' | 'total'>): string {
  return `${plural(value.tested, 'critère testé', 'critères testés')} automatiquement sur ${value.total}`;
}

/**
 * Full accessible name of a gauge, e.g.
 * "Images : 78 sur 100, palier À corriger, 4 critères testés sur 9".
 */
export function gaugeAccessibleName(name: string, value: ScoreValue): string {
  if (value.score === null) {
    return `${name} : non évaluable, aucun critère testé automatiquement sur ${value.total}`;
  }
  const info = tierInfo(value.score);
  return `${name} : ${value.score} sur 100, palier ${info.label}, ${plural(value.tested, 'critère testé', 'critères testés')} sur ${value.total}`;
}
