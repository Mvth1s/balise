/**
 * Generates src/data/rgaa-4.1.2.json from the official RGAA criteria file
 * published by DINUM (DISIC/accessibilite.numerique.gouv.fr, RGAA/criteres.json)
 * and from the hand-maintained rule mappings in ./rules-4.1.2.ts.
 *
 * The criteria file is treated as untrusted data: it is parsed as JSON only,
 * validated, and nothing from it is executed.
 *
 * Usage (from the repository root):
 *   node --experimental-strip-types packages/rgaa-mapping/scripts/generate-rgaa-4.1.2.ts \
 *     --criteria <path/to/criteres.json> --sha <commit SHA> --retrieved <YYYY-MM-DD>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { RgaaCriterion, RgaaReference, RgaaTheme } from '../src/types.ts';
import { AXE_VERSION, REVIEWED_ON, RULES } from './rules-4.1.2.ts';

const REPO = 'DISIC/accessibilite.numerique.gouv.fr';
const CRITERIA_PATH = 'RGAA/criteres.json';
const RGAA_URL = 'https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/';
const EXPECTED_THEMES = 13;
const EXPECTED_CRITERIA = 106;

interface OfficialCriterium {
  number: number | string;
  title: string;
  references?: Array<{ wcag?: string[]; techniques?: string[] }>;
}
interface OfficialTopic {
  topic: string;
  number: number;
  criteria: Array<{ criterium: OfficialCriterium }>;
}
interface OfficialFile {
  topics: OfficialTopic[];
}

/** Removes glossary links `[label](#slug)` (keeps the label) and normalises whitespace. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\(#[^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function fail(message: string): never {
  console.error(`generate-rgaa-4.1.2: ${message}`);
  process.exit(1);
}

function main(): void {
  const { values } = parseArgs({
    options: {
      criteria: { type: 'string' },
      sha: { type: 'string' },
      retrieved: { type: 'string' },
    },
  });
  if (!values.criteria || !values.sha || !values.retrieved) {
    fail('missing --criteria, --sha or --retrieved');
  }
  if (!/^[0-9a-f]{40}$/.test(values.sha)) fail('--sha must be a full 40-character commit SHA');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.retrieved)) fail('--retrieved must be YYYY-MM-DD');

  const official = JSON.parse(readFileSync(values.criteria, 'utf8')) as OfficialFile;
  if (!Array.isArray(official.topics)) fail('unexpected file format: no "topics" array');

  const themes: RgaaTheme[] = [];
  const criteria: RgaaCriterion[] = [];
  for (const topic of official.topics) {
    if (!Number.isInteger(topic.number) || typeof topic.topic !== 'string') {
      fail(`invalid topic entry: ${JSON.stringify(topic).slice(0, 80)}`);
    }
    themes.push({ number: topic.number, title: toPlainText(topic.topic) });
    for (const { criterium } of topic.criteria) {
      const id = `${topic.number}.${criterium.number}`;
      if (!/^\d{1,2}\.\d{1,2}$/.test(id)) fail(`invalid criterion number: ${id}`);
      if (typeof criterium.title !== 'string' || !criterium.title.trim()) {
        fail(`missing title for criterion ${id}`);
      }
      const wcag = (criterium.references ?? []).flatMap((r) => r.wcag ?? []);
      criteria.push({
        id,
        theme: topic.number,
        title: toPlainText(criterium.title),
        url: `${RGAA_URL}#${id}`,
        ...(wcag.length > 0 ? { wcag } : {}),
      });
    }
  }
  if (themes.length !== EXPECTED_THEMES)
    fail(`expected ${EXPECTED_THEMES} themes, got ${themes.length}`);
  if (criteria.length !== EXPECTED_CRITERIA) {
    fail(`expected ${EXPECTED_CRITERIA} criteria, got ${criteria.length}`);
  }

  const ids = new Set(criteria.map((c) => c.id));
  const seenRules = new Set<string>();
  for (const rule of RULES) {
    if (seenRules.has(rule.rule)) fail(`duplicate rule mapping: ${rule.rule}`);
    seenRules.add(rule.rule);
    for (const c of rule.criteria) {
      if (!ids.has(c)) fail(`rule ${rule.rule} points to unknown criterion ${c}`);
    }
  }

  const reference: RgaaReference = {
    version: '4.1.2',
    name: 'RGAA 4.1.2',
    sources: [
      {
        url: `https://github.com/${REPO}/blob/${values.sha}/${CRITERIA_PATH}`,
        retrieved: values.sha,
        note: `Fichier officiel des critères (DINUM), récupéré le ${values.retrieved}. Thématiques, numéros, intitulés et références WCAG en sont extraits ; les liens vers le glossaire sont retirés (texte conservé) et les espaces normalisés.`,
      },
      {
        url: RGAA_URL,
        retrieved: values.retrieved,
        note: 'Page officielle « Critères et tests » du RGAA 4.1.2 : format des ancres (#thématique.critère) et contrôle croisé des 106 intitulés.',
      },
      {
        url: `https://github.com/dequelabs/axe-core/tree/v${AXE_VERSION}`,
        retrieved: REVIEWED_ON,
        note: `Règles axe-core ${AXE_VERSION} (axe.getRules()) et fiches dequeuniversity.com/rules/axe/4.14, utilisées pour la correspondance règles → critères.`,
      },
    ],
    themes,
    criteria,
    rules: RULES,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, '../src/data/rgaa-4.1.2.json');
  writeFileSync(out, `${JSON.stringify(reference, null, 2)}\n`);
  console.log(
    `Wrote ${out}: ${themes.length} themes, ${criteria.length} criteria, ${RULES.length} rules.`,
  );
}

main();
