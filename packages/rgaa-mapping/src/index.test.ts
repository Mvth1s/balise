import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REFERENCE_VERSION,
  getCriterion,
  getReference,
  getTheme,
  listReferenceVersions,
  mappingForRule,
  rulesForCriterion,
} from './index.js';

const require = createRequire(import.meta.url);
const axe = require('axe-core') as {
  version: string;
  getRules: () => Array<{ ruleId: string }>;
};

const ref = getReference();
const BALISE_RULES = [
  'balise-skip-link',
  'balise-heading-hierarchy',
  'balise-page-lang',
  'balise-page-title',
  'balise-doctype',
  'balise-duplicate-id',
  'balise-presentation-markup',
  'balise-dir-valid',
  'balise-page-title-relevant',
  'balise-link-generic',
  'balise-data-table-headers',
  'balise-layout-table',
  'balise-decorative-img',
  'balise-img-alt-relevant',
  'balise-field-label',
  'balise-radio-group',
  'balise-group-legend',
  'balise-empty-paragraph',
  'balise-focus-visible',
];

describe('loader API', () => {
  it('lists the registered versions and defaults to 4.1.2', () => {
    expect(DEFAULT_REFERENCE_VERSION).toBe('4.1.2');
    expect(listReferenceVersions()).toContain('4.1.2');
    expect(getReference('4.1.2')).toBe(ref);
    expect(ref.version).toBe('4.1.2');
  });

  it('throws on an unknown version', () => {
    expect(() => getReference('9.9')).toThrow(/Unknown RGAA reference version: 9\.9/);
  });

  it('finds themes and criteria', () => {
    expect(getTheme(ref, 1)?.title).toBe('Images');
    expect(getTheme(ref, 14)).toBeUndefined();
    expect(getCriterion(ref, '1.1')?.theme).toBe(1);
    expect(getCriterion(ref, '99.1')).toBeUndefined();
  });

  it('finds rule mappings in both directions', () => {
    expect(mappingForRule(ref, 'image-alt')?.criteria).toContain('1.1');
    expect(mappingForRule(ref, 'not-a-rule')).toBeUndefined();
    const forTitle = rulesForCriterion(ref, '8.5').map((r) => r.rule);
    expect(forTitle).toEqual(expect.arrayContaining(['document-title', 'balise-page-title']));
    expect(rulesForCriterion(ref, '13.12')).toEqual([]);
  });
});

describe('RGAA 4.1.2 reference data', () => {
  it('has the 13 official themes, numbered 1 to 13', () => {
    expect(ref.themes).toHaveLength(13);
    expect(ref.themes.map((t) => t.number)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(ref.themes.map((t) => t.title)).toEqual([
      'Images',
      'Cadres',
      'Couleurs',
      'Multimédia',
      'Tableaux',
      'Liens',
      'Scripts',
      'Éléments obligatoires',
      'Structuration de l’information',
      'Présentation de l’information',
      'Formulaires',
      'Navigation',
      'Consultation',
    ]);
  });

  it('has the 106 official criteria with the expected count per theme', () => {
    expect(ref.criteria).toHaveLength(106);
    const perTheme = ref.themes.map((t) => ref.criteria.filter((c) => c.theme === t.number).length);
    expect(perTheme).toEqual([9, 2, 3, 13, 8, 2, 5, 10, 4, 14, 13, 11, 12]);
  });

  it('has unique, well-formed criteria ids pointing to existing themes', () => {
    const ids = ref.criteria.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of ref.criteria) {
      expect(c.id).toMatch(/^\d{1,2}\.\d{1,2}$/);
      expect(c.id.split('.')[0]).toBe(String(c.theme));
      expect(getTheme(ref, c.theme)).toBeDefined();
      expect(c.url).toBe(
        `https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${c.id}`,
      );
      expect(c.title.trim()).not.toBe('');
      expect(c.title).not.toMatch(/\]\(#|<[a-z]/i);
      expect(c.wcag?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps official titles verbatim (spot checks)', () => {
    expect(getCriterion(ref, '1.1')?.title).toBe(
      'Chaque image porteuse d’information a-t-elle une alternative textuelle ?',
    );
    expect(getCriterion(ref, '8.5')?.title).toBe('Chaque page web a-t-elle un titre de page ?');
    expect(getCriterion(ref, '12.7')?.title).toBe(
      'Dans chaque page web, un lien d’évitement ou d’accès rapide à la zone de contenu principal est-il présent (hors cas particuliers) ?',
    );
  });

  it('cites its sources with a commit SHA', () => {
    expect(ref.sources.length).toBeGreaterThan(0);
    expect(ref.sources.some((s) => /^[0-9a-f]{40}$/.test(s.retrieved))).toBe(true);
  });
});

describe('rule mappings', () => {
  const axeRuleIds = new Set(axe.getRules().map((r) => r.ruleId));
  const criterionIds = new Set(ref.criteria.map((c) => c.id));

  it('uses axe-core 4.14.0', () => {
    expect(axe.version).toBe('4.14.0');
  });

  it('has unique rule ids', () => {
    const rules = ref.rules.map((r) => r.rule);
    expect(new Set(rules).size).toBe(rules.length);
  });

  it('maps every rule to at least one existing criterion', () => {
    for (const r of ref.rules) {
      expect(r.criteria.length, r.rule).toBeGreaterThan(0);
      for (const c of r.criteria) expect(criterionIds.has(c), `${r.rule} → ${c}`).toBe(true);
    }
  });

  it('only maps axe rules that exist in axe-core 4.14.0', () => {
    for (const r of ref.rules.filter((m) => m.engine === 'axe')) {
      expect(axeRuleIds.has(r.rule), r.rule).toBe(true);
    }
  });

  it('includes the four Balise custom checks with their frozen ids', () => {
    for (const id of BALISE_RULES) {
      expect(mappingForRule(ref, id)?.engine, id).toBe('balise');
    }
    expect(
      ref.rules
        .filter((r) => r.engine === 'balise')
        .map((r) => r.rule)
        .sort(),
    ).toEqual([...BALISE_RULES].sort());
    expect(mappingForRule(ref, 'balise-skip-link')?.criteria).toEqual(['12.7']);
    expect(mappingForRule(ref, 'balise-heading-hierarchy')?.criteria).toEqual(['9.1']);
    expect(mappingForRule(ref, 'balise-page-lang')?.criteria).toEqual(['8.3', '8.4']);
    expect(mappingForRule(ref, 'balise-page-title')?.criteria).toEqual(['8.5']);
  });

  it('documents every mapping (rationale, explanation, fix, source)', () => {
    for (const r of ref.rules) {
      expect(['axe', 'balise']).toContain(r.engine);
      expect(['full', 'partial']).toContain(r.coverage);
      expect(r.rationale.trim(), r.rule).not.toBe('');
      expect(r.explanation.trim(), r.rule).not.toBe('');
      expect(r.fix.trim(), r.rule).not.toBe('');
      expect(r.source.url, r.rule).toMatch(/^https:\/\//);
      expect(r.source.retrieved, r.rule).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (r.engine === 'axe') {
        expect(r.source.url).toBe(`https://dequeuniversity.com/rules/axe/4.14/${r.rule}`);
      }
    }
  });

  it('keeps full coverage limited to rules covering a single criterion', () => {
    for (const r of ref.rules.filter((m) => m.coverage === 'full')) {
      expect(r.criteria, r.rule).toHaveLength(1);
    }
  });
});
