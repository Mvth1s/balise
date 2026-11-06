/**
 * Indicative scores. Pure module, importable in the browser
 * (`@balise/analyzer/scoring`): no Node import.
 */
import defaultConfig from './config/scoring.json' with { type: 'json' };
import type { CriterionResult, ScoreTier, ScoreValue, ThemeScore } from './types.js';

export interface ScoringConfig {
  /** Weight per theme number (missing → 1). */
  weights: Record<string, number>;
  /** Lower bounds of the tiers: score ≥ good → good; ≥ warn → warn; else bad. */
  tiers: { good: number; warn: number };
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: defaultConfig.weights,
  tiers: defaultConfig.tiers,
};

/** Tier of a score: 90-100 good, 50-89 warn, 0-49 bad; null → null. */
export function tierFor(
  score: number | null,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreTier | null {
  if (score === null || Number.isNaN(score)) return null;
  if (score >= config.tiers.good) return 'good';
  if (score >= config.tiers.warn) return 'warn';
  return 'bad';
}

/** round(100 × C / (C + NC)); null when nothing was tested. */
export function ratioScore(conformes: number, nonConformes: number): number | null {
  const tested = conformes + nonConformes;
  return tested === 0 ? null : Math.round((100 * conformes) / tested);
}

function countStatuses(
  criteria: readonly Pick<CriterionResult, 'status'>[],
): Omit<ScoreValue, 'score' | 'tier'> {
  const conformes = criteria.filter((c) => c.status === 'conforme').length;
  const nonConformes = criteria.filter((c) => c.status === 'non-conforme').length;
  return { conformes, nonConformes, tested: conformes + nonConformes, total: criteria.length };
}

export function themeScore(
  theme: { number: number; title: string },
  criteria: readonly Pick<CriterionResult, 'status' | 'theme'>[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ThemeScore {
  const counts = countStatuses(criteria.filter((c) => c.theme === theme.number));
  const score = ratioScore(counts.conformes, counts.nonConformes);
  return {
    theme: theme.number,
    title: theme.title,
    ...counts,
    score,
    tier: tierFor(score, config),
  };
}

/**
 * Global score: weighted mean of theme scores, weight = tested criteria ×
 * theme weight. null when no criterion was tested.
 */
export function globalScore(
  themes: readonly ThemeScore[],
  criteria: readonly Pick<CriterionResult, 'status'>[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreValue {
  const counts = countStatuses(criteria);
  let weighted = 0;
  let weights = 0;
  for (const t of themes) {
    if (t.score === null) continue;
    const w = t.tested * (config.weights[String(t.theme)] ?? 1);
    weighted += t.score * w;
    weights += w;
  }
  const score = weights > 0 ? Math.round(weighted / weights) : null;
  return { ...counts, score, tier: tierFor(score, config) };
}

export function computeScores(
  themes: readonly { number: number; title: string }[],
  criteria: readonly Pick<CriterionResult, 'status' | 'theme'>[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): { global: ScoreValue; themes: ThemeScore[] } {
  const themeScores = [...themes]
    .sort((a, b) => a.number - b.number)
    .map((t) => themeScore(t, criteria, config));
  return { global: globalScore(themeScores, criteria, config), themes: themeScores };
}
