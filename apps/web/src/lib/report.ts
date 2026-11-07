import type {
  AnalysisReport,
  CriterionResult,
  CriterionStatus,
  ThemeScore,
} from '@balise/analyzer/types';
import { pluralize } from './format';

/** RGAA 4.1.2 themes, used as a fallback when a theme title is missing. */
export const RGAA_THEMES: Readonly<Record<number, string>> = {
  1: 'Images',
  2: 'Cadres',
  3: 'Couleurs',
  4: 'Multimédia',
  5: 'Tableaux',
  6: 'Liens',
  7: 'Scripts',
  8: 'Éléments obligatoires',
  9: 'Structuration de l’information',
  10: 'Présentation de l’information',
  11: 'Formulaires',
  12: 'Navigation',
  13: 'Consultation',
};

export function themeTitle(report: AnalysisReport, theme: number): string {
  return (
    report.scores.themes.find((t) => t.theme === theme)?.title ??
    RGAA_THEMES[theme] ??
    `Thématique ${theme}`
  );
}

export type StatusCounts = Record<CriterionStatus, number>;

export function countByStatus(criteria: readonly CriterionResult[]): StatusCounts {
  const counts: StatusCounts = {
    'non-conforme': 0,
    'a-verifier': 0,
    conforme: 0,
    'non-applicable': 0,
  };
  for (const c of criteria) counts[c.status] += 1;
  return counts;
}

/** Numeric sort of criterion ids: "1.2" < "1.10" < "2.1". */
export function compareCriterionIds(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface CriteriaFilter {
  statuses: ReadonlySet<CriterionStatus>;
  /** null: every theme. */
  theme: number | null;
}

export function filterCriteria(
  criteria: readonly CriterionResult[],
  filter: CriteriaFilter,
): CriterionResult[] {
  return criteria
    .filter((c) => filter.statuses.has(c.status))
    .filter((c) => filter.theme === null || c.theme === filter.theme)
    .sort((a, b) => compareCriterionIds(a.id, b.id));
}

/** Total number of affected elements of a criterion. */
export function affectedCount(criterion: CriterionResult): number {
  return criterion.findings.reduce((sum, f) => sum + f.count, 0);
}

/** "3 éléments concernés" */
export function affectedLabel(criterion: CriterionResult): string {
  const n = affectedCount(criterion);
  return n === 0 ? 'Aucun élément listé' : pluralize(n, 'élément concerné', 'éléments concernés');
}

/** Themes ordered by number. */
export function sortedThemes(report: AnalysisReport): ThemeScore[] {
  return [...report.scores.themes].sort((a, b) => a.theme - b.theme);
}

/** File name of the JSON export. */
export function exportFileName(report: AnalysisReport): string {
  const safeId = report.id.replace(/[^a-zA-Z0-9_-]/g, '');
  return `balise-rapport-${safeId || 'analyse'}.json`;
}

/** External link from report data: only http(s), never javascript: or data:. */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
