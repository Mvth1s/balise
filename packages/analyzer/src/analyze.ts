/**
 * Orchestration: validation → navigation → axe + custom checks → mapping →
 * scores → AnalysisReport (+ screenshot as a separate Buffer).
 */
import { randomUUID } from 'node:crypto';
import { getReference, type RgaaReference } from '@balise/rgaa-mapping';
import type { Browser } from 'playwright-core';
import { createHardenedContext, launchBrowser } from './browser.js';
import { detectPagePresence, runChecks } from './checks/index.js';
import { AnalysisAbortedError, throwIfAborted, toAnalysisError } from './errors.js';
import { collectJudgePack, type JudgePack } from './judge-pack.js';
import { mappedRules, mapResults } from './map-results.js';
import { navigate, type FetchFn, type NavigationLimits } from './navigate.js';
import { normalizeCheckResult, type NormalizedRuleResult } from './results.js';
import { AXE_VERSION, runAxe } from './run-axe.js';
import { computeScores, DEFAULT_SCORING_CONFIG, type ScoringConfig } from './scoring.js';
import type { AnalysisReport, AnalysisStep } from './types.js';
import { defaultLookup, validateTarget, type LookupAll } from './url-guard.js';
import { BALISE_ENGINE_VERSION } from './version.js';

export interface AnalyzeOptions {
  /** Report id (defaults to a random UUID). */
  id?: string;
  /** Called when a step is COMPLETED: loading, testing, scoring. */
  onStep?: (step: AnalysisStep) => void | Promise<void>;
  signal?: AbortSignal;
  reference?: RgaaReference;
  lookup?: LookupAll;
  /** Tests and demo build only. Never wire this to configuration. */
  allowPrivateHosts?: boolean;
  limits?: Partial<NavigationLimits>;
  scoring?: ScoringConfig;
  /** Injected browser launcher (tests). */
  launch?: () => Promise<Browser>;
  /** Injected fetch (tests). */
  fetch?: FetchFn;
  now?: () => Date;
}

export interface AnalyzeResult {
  report: AnalysisReport;
  screenshot: Buffer;
  /** Elements for the AI judgement (judged by the API, never by the engine). */
  pack?: JudgePack | null;
}

/**
 * Analyses one page. Throws AnalysisError (typed code, French message) or
 * AnalysisAbortedError when `signal` is aborted.
 */
export async function analyzePage(
  input: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const now = options.now ?? (() => new Date());
  const started = now();
  const { signal } = options;
  const lookup = options.lookup ?? defaultLookup;
  const ref = options.reference ?? getReference();
  const guard = { allowPrivateHosts: options.allowPrivateHosts === true };

  try {
    throwIfAborted(signal);
    const { url } = await validateTarget(input, lookup, guard);
    throwIfAborted(signal);

    const browser = await (options.launch ?? (() => launchBrowser()))();
    // Closing the browser interrupts any phase, including a page script stuck
    // in an infinite loop during axe or the custom checks.
    const onAbort = (): void => void browser.close().catch(() => undefined);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      throwIfAborted(signal);
      const context = await createHardenedContext(browser);
      const page = await context.newPage();
      const nav = await navigate(page, url.href, {
        lookup,
        allowPrivateHosts: guard.allowPrivateHosts,
        signal,
        limits: options.limits,
        fetch: options.fetch,
      });
      await options.onStep?.('loading');
      throwIfAborted(signal);

      const axeResults = await runAxe(page, mappedRules(ref, 'axe'));
      throwIfAborted(signal);
      const checkResults = (await runChecks(page)).map(normalizeCheckResult);
      const pageInfo = (await page.evaluate(
        '({ title: document.title, lang: document.documentElement.getAttribute("lang") })',
      )) as { title: unknown; lang: unknown };
      await options.onStep?.('testing');
      throwIfAborted(signal);

      const presence = await detectPagePresence(page);
      const pack = await collectJudgePack(page);
      const results: NormalizedRuleResult[] = [...axeResults, ...checkResults];
      const criteria = mapResults(ref, results, presence);
      const scores = computeScores(ref.themes, criteria, options.scoring ?? DEFAULT_SCORING_CONFIG);
      const finished = now();
      const report: AnalysisReport = {
        schemaVersion: 1,
        id: options.id ?? randomUUID(),
        url: input.trim(),
        finalUrl: nav.finalUrl,
        analyzedAt: finished.toISOString(),
        durationMs: Math.max(0, finished.getTime() - started.getTime()),
        reference: { name: ref.name, version: ref.version },
        engine: { balise: BALISE_ENGINE_VERSION, axe: AXE_VERSION, chromium: browser.version() },
        page: {
          title: typeof pageInfo.title === 'string' ? pageInfo.title.slice(0, 1000) : '',
          lang:
            typeof pageInfo.lang === 'string' && pageInfo.lang.trim() !== ''
              ? pageInfo.lang.slice(0, 100)
              : null,
        },
        scores,
        criteria,
        hasScreenshot: nav.screenshot.length > 0,
      };
      await options.onStep?.('scoring');
      return { report, screenshot: nav.screenshot, pack };
    } finally {
      signal?.removeEventListener('abort', onAbort);
      await browser.close().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof AnalysisAbortedError || signal?.aborted) throw new AnalysisAbortedError();
    throw toAnalysisError(error);
  }
}
