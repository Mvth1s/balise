/**
 * Fast fake analysis engine for end-to-end tests (no browser, no network).
 * Enabled by BALISE_E2E_FAKE_ANALYZER=1, and ONLY outside production and
 * outside Vercel (see `isFakeAnalyzerEnabled`).
 *
 * - URL containing "unreachable" → `unreachable` error;
 * - otherwise a plausible report (a few failures, passes and manual checks).
 */
import {
  AnalysisAbortedError,
  AnalysisError,
  BALISE_ENGINE_VERSION,
  computeScores,
  mapResults,
  type AnalyzeOptions,
  type AnalyzeResult,
  type NormalizedRuleResult,
} from '@balise/analyzer';
import { getReference } from '@balise/rgaa-mapping';

/** Tiny 16×10 JPEG (solid blue). */
export const FAKE_SCREENSHOT = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAKABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCMApBz/9k=',
  'base64',
);

export function isFakeAnalyzerEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.BALISE_E2E_FAKE_ANALYZER === '1' && env.NODE_ENV !== 'production' && !env.VERCEL;
}

const fail = (
  rule: string,
  engine: 'axe' | 'balise',
  selector: string,
  html: string,
): NormalizedRuleResult => ({
  rule,
  engine,
  outcome: 'fail',
  failures: [{ selector, html }],
  passedCount: 0,
});
const pass = (rule: string, engine: 'axe' | 'balise' = 'axe'): NormalizedRuleResult => ({
  rule,
  engine,
  outcome: 'pass',
  failures: [],
  passedCount: 1,
});

const FAKE_RESULTS: NormalizedRuleResult[] = [
  fail('image-alt', 'axe', 'main > img:nth-of-type(1)', '<img src="/logo.png">'),
  fail('color-contrast', 'axe', '.bandeau > p', '<p class="bandeau">Texte peu contrasté</p>'),
  fail(
    'balise-heading-hierarchy',
    'balise',
    'main > h4',
    '<h4>Titre sans niveau intermédiaire</h4>',
  ),
  fail('label', 'axe', '#recherche', '<input id="recherche" type="search">'),
  pass('document-title'),
  pass('balise-page-title', 'balise'),
  pass('html-has-lang'),
  pass('html-lang-valid'),
  pass('balise-page-lang', 'balise'),
  pass('frame-title'),
  pass('link-name'),
  pass('list'),
  pass('listitem'),
  pass('th-has-data-cells'),
];

export async function fakeAnalyzePage(
  input: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const { signal } = options;
  const step = async (name: 'loading' | 'testing' | 'scoring'): Promise<void> => {
    await new Promise((r) => setTimeout(r, 150));
    if (signal?.aborted) throw new AnalysisAbortedError();
    await options.onStep?.(name);
    if (signal?.aborted) throw new AnalysisAbortedError();
  };
  const started = Date.now();
  if (signal?.aborted) throw new AnalysisAbortedError();
  if (input.includes('unreachable')) {
    await new Promise((r) => setTimeout(r, 150));
    throw new AnalysisError('unreachable');
  }
  await step('loading');
  await step('testing');
  const ref = getReference();
  // One simulated AI verdict, so that the end-to-end tests cover the "(IA)" badge.
  const criteria = mapResults(ref, FAKE_RESULTS).map((c) =>
    c.id === '8.6' && c.status === 'a-verifier'
      ? {
          ...c,
          status: 'non-conforme-ia' as const,
          ai: {
            justification: 'Le titre « Page de test » ne décrit pas le contenu (moteur simulé).',
            confidence: 0.8,
            model: 'simulé',
            selectors: [],
          },
        }
      : c,
  );
  const report = {
    schemaVersion: 1 as const,
    id: options.id ?? 'fake',
    url: input.trim(),
    finalUrl: new URL(input.trim()).href,
    analyzedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    reference: { name: ref.name, version: ref.version },
    engine: { balise: BALISE_ENGINE_VERSION, axe: '4.14.0', chromium: 'fake' },
    page: { title: 'Page de test (moteur simulé)', lang: 'fr' },
    scores: computeScores(ref.themes, criteria),
    criteria,
    hasScreenshot: true,
  };
  await step('scoring');
  return { report, screenshot: FAKE_SCREENSHOT };
}
