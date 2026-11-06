import type { RgaaCriterion, RgaaReference, RgaaTheme, RuleMapping } from './types.js';
import rgaa412 from './data/rgaa-4.1.2.json' with { type: 'json' };

export type * from './types.js';

/** Registered reference versions. Add `rgaa-5.json` here when published. */
const REFERENCES: Record<string, RgaaReference> = {
  '4.1.2': rgaa412 as RgaaReference,
};

export const DEFAULT_REFERENCE_VERSION = '4.1.2';

export function listReferenceVersions(): string[] {
  return Object.keys(REFERENCES);
}

export function getReference(version: string = DEFAULT_REFERENCE_VERSION): RgaaReference {
  const ref = REFERENCES[version];
  if (!ref) throw new Error(`Unknown RGAA reference version: ${version}`);
  return ref;
}

export function getTheme(ref: RgaaReference, theme: number): RgaaTheme | undefined {
  return ref.themes.find((t) => t.number === theme);
}

export function getCriterion(ref: RgaaReference, id: string): RgaaCriterion | undefined {
  return ref.criteria.find((c) => c.id === id);
}

/** All rule mappings that contribute to a given criterion. */
export function rulesForCriterion(ref: RgaaReference, id: string): RuleMapping[] {
  return ref.rules.filter((r) => r.criteria.includes(id));
}

/** Mapping entry for a rule id, if the rule is mapped. */
export function mappingForRule(ref: RgaaReference, rule: string): RuleMapping | undefined {
  return ref.rules.find((r) => r.rule === rule);
}
