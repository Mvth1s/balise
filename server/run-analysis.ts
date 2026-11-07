/**
 * Runs one analysis with a hard time limit and cancellation, and reports the
 * outcome to a sink. The sink is the Redis store (local, in-process mode) or
 * the HTTP writer of the API (isolated Chromium worker, server/worker.ts).
 */
import {
  AnalysisAbortedError,
  AnalysisError,
  toAnalysisError,
  type AnalysisReport,
  type AnalysisStep,
  type JudgePack,
} from '@balise/analyzer';
import type { AnalyzeFn } from './handlers.ts';

export interface AnalysisSink {
  /** True when the analysis was cancelled or no longer exists. */
  cancelled(): Promise<boolean>;
  /** Progress; may throw AnalysisAbortedError when cancelled meanwhile. */
  step(step: AnalysisStep): Promise<void>;
  /** `pack`: elements for the AI judgement, judged by the API only. */
  done(report: AnalysisReport, screenshot: Buffer, pack: JudgePack | null): Promise<void>;
  failed(error: { code: string; message: string }): Promise<void>;
}

export interface RunOptions {
  analyze: AnalyzeFn;
  cancelPollMs: number;
  maxAnalysisMs: number;
  log: (message: string, error?: unknown) => void;
}

export async function runAnalysis(
  id: string,
  url: string,
  sink: AnalysisSink,
  { analyze, cancelPollMs, maxAnalysisMs, log }: RunOptions,
): Promise<void> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Hard ceiling even if the engine ignores the abort signal.
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new AnalysisAbortedError());
    }, maxAnalysisMs);
  });
  const poll = setInterval(() => {
    sink
      .cancelled()
      .then((cancelled) => {
        if (cancelled) controller.abort();
      })
      .catch(() => undefined);
  }, cancelPollMs);
  const step = async (s: AnalysisStep): Promise<void> => {
    try {
      await sink.step(s);
    } catch (error) {
      if (error instanceof AnalysisAbortedError) controller.abort();
      throw error;
    }
  };

  try {
    await step('queued');
    const running = analyze(url, { id, signal: controller.signal, onStep: step });
    running.catch(() => undefined); // may settle after the deadline
    const { report, screenshot, pack } = await Promise.race([running, deadline]);
    await sink.done({ ...report, hasScreenshot: screenshot.length > 0 }, screenshot, pack ?? null);
  } catch (error) {
    if (error instanceof AnalysisAbortedError && !timedOut) return; // cancelled by the user
    const err = timedOut
      ? new AnalysisError('unreachable', "L'analyse a dépassé la durée maximale autorisée.")
      : toAnalysisError(error);
    if (err.code === 'internal') log(`analysis ${id} failed`, error);
    await sink.failed({ code: err.code, message: err.message }).catch(() => undefined);
  } finally {
    clearTimeout(timer);
    clearInterval(poll);
  }
}
