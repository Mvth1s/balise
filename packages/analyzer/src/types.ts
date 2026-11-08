/**
 * Public contract of an analysis report. Shared by the analyzer, the API and
 * the web app (type-only import: `@balise/analyzer/types`).
 *
 * Every string coming from the analysed page (selectors, HTML snippets, title)
 * is stored raw and MUST be rendered as text (escaped) by consumers.
 */

/** Per-criterion status. */
export type CriterionStatus =
  | 'conforme' // Conforme (auto)
  | 'non-conforme' // Non conforme (auto)
  | 'a-verifier' // À vérifier manuellement
  | 'conforme-ia' // Conforme (IA)
  | 'non-conforme-ia' // Non conforme (IA)
  | 'non-applicable'; // Non applicable

export type ScoreTier = 'good' | 'warn' | 'bad';

export interface ScoreValue {
  /** 0-100 integer, or null when "Non évaluable" (no tested criterion). */
  score: number | null;
  tier: ScoreTier | null;
  /** Number of criteria with status conforme or non-conforme. */
  tested: number;
  /** Total number of criteria in scope (theme or whole reference). */
  total: number;
  conformes: number;
  nonConformes: number;
}

export interface ThemeScore extends ScoreValue {
  theme: number;
  title: string;
}

export interface FindingNode {
  /** CSS selector of the element (raw, from the analysed page). */
  selector: string;
  /** Outer HTML snippet, truncated (raw, from the analysed page). */
  html: string;
}

export interface Finding {
  rule: string;
  engine: 'axe' | 'balise';
  /** French explanation of the problem (from the mapping). */
  explanation: string;
  /** French remediation hint (from the mapping). */
  fix: string;
  /** Link to rule documentation (axe) when available. */
  helpUrl?: string;
  /** Total number of affected elements (nodes may be truncated). */
  count: number;
  nodes: FindingNode[];
}

export interface CriterionResult {
  id: string;
  theme: number;
  title: string;
  url: string;
  status: CriterionStatus;
  /** Rules that were evaluated for this criterion. */
  rules: string[];
  /** Failures (only for status non-conforme). */
  findings: Finding[];
  /**
   * Why the criterion is "non-applicable" when no element it applies to was
   * found (French labels, e.g. ["tableau"]).
   */
  absent?: string[];
  /** AI judgement (statuses conforme-ia / non-conforme-ia only). */
  ai?: AiJudgement;
}

export interface AiJudgement {
  /** Short French justification. */
  justification: string;
  /** 0 to 1, as reported by the model. */
  confidence: number;
  /** Model identifier, e.g. "mistral-large-4". */
  model: string;
  /** Elements concerned (selectors from the analysed page, raw). */
  selectors: string[];
}

export interface AnalysisReport {
  /** Report format version. */
  schemaVersion: 1;
  id: string;
  /** URL submitted by the user. */
  url: string;
  /** URL after redirects. */
  finalUrl: string;
  analyzedAt: string;
  durationMs: number;
  reference: { name: string; version: string };
  engine: { balise: string; axe: string; chromium: string };
  page: { title: string; lang: string | null };
  scores: { global: ScoreValue; themes: ThemeScore[] };
  criteria: CriterionResult[];
  /** Whether a screenshot is available at GET /api/analyses/:id/screenshot. */
  hasScreenshot: boolean;
}

/** Steps shown on the "analyse en cours" screen, in order. */
export const ANALYSIS_STEPS = ['validated', 'queued', 'loading', 'testing', 'scoring'] as const;
export type AnalysisStep = (typeof ANALYSIS_STEPS)[number];

export type AnalysisState = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

/** Error codes returned by the API and stored on failed analyses. */
export type AnalysisErrorCode =
  | 'invalid_url'
  | 'forbidden_target' // private / reserved address, forbidden port or scheme
  | 'dns_failure'
  | 'rate_limited'
  | 'unreachable' // network error, timeout, HTTP >= 400 on the main document
  | 'too_large'
  | 'not_html'
  | 'not_found'
  | 'internal';

/** Payload of GET /api/analyses/:id */
export interface AnalysisStatus {
  id: string;
  url: string;
  state: AnalysisState;
  /** Last completed step (undefined before the first one). */
  step?: AnalysisStep;
  createdAt: string;
  updatedAt: string;
  error?: { code: AnalysisErrorCode; message: string };
  report?: AnalysisReport;
}
