/**
 * Data model of a versioned RGAA reference file (e.g. data/rgaa-4.1.2.json).
 * The same shape must be used for future versions (rgaa-5.json).
 */

/** Where a piece of data comes from (official URL + retrieval date or commit). */
export interface SourceRef {
  url: string;
  /** ISO date of retrieval, or git commit SHA of the official repository. */
  retrieved: string;
  note?: string;
}

export interface RgaaTheme {
  /** Theme number, 1 to 13 for RGAA 4.1.2. */
  number: number;
  /** Official French title, e.g. "Images". */
  title: string;
}

export interface RgaaCriterion {
  /** Criterion id "theme.number", e.g. "1.1". */
  id: string;
  theme: number;
  /** Official French title, verbatim. */
  title: string;
  /** Link to the official criterion page (anchor). */
  url: string;
  /** WCAG success criteria referenced by the official reference, when provided. */
  wcag?: string[];
}

/** Origin of a test rule. */
export type RuleEngine = 'axe' | 'balise';

/**
 * Mapping of one test rule (axe-core rule id or Balise custom check id)
 * to one or more RGAA criteria.
 */
export interface RuleMapping {
  /** Rule id, e.g. "image-alt" (axe) or "balise-skip-link" (custom). */
  rule: string;
  engine: RuleEngine;
  /** Criterion ids this rule contributes to, e.g. ["1.1"]. */
  criteria: string[];
  /**
   * full: when the rule passes on applicable elements and nothing is incomplete,
   *       the criterion may be reported "Conforme (auto)".
   * partial: the rule can only detect failures; a pass leaves the criterion
   *          "À vérifier manuellement".
   */
  coverage: 'full' | 'partial';
  /** Why this rule relates to these criteria (French, one sentence). */
  rationale: string;
  /** Short French explanation of the problem, shown in the report. */
  explanation: string;
  /** Short French remediation hint, shown in the report. */
  fix: string;
  source: SourceRef;
}

export interface RgaaReference {
  /** Reference version, e.g. "4.1.2". */
  version: string;
  name: string;
  sources: SourceRef[];
  themes: RgaaTheme[];
  criteria: RgaaCriterion[];
  rules: RuleMapping[];
}
