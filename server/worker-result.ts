/**
 * Validation of what the isolated worker sends back. The worker ran untrusted
 * pages: its output is checked for shape and size before being stored (the
 * front end escapes every value anyway).
 */
import { ERROR_MESSAGES, type AnalysisErrorCode, type AnalysisReport } from '@balise/analyzer';

export type WorkerResult =
  | { report: AnalysisReport; screenshot: Buffer }
  | { error: { code: AnalysisErrorCode; message: string } };

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export function parseWorkerResult(text: string, id: string): WorkerResult | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object') return null;
  const b = body as { report?: unknown; screenshot?: unknown; error?: unknown };
  if (b.error && typeof b.error === 'object') {
    const e = b.error as { code?: unknown; message?: unknown };
    const code = (
      typeof e.code === 'string' && e.code in ERROR_MESSAGES ? e.code : 'internal'
    ) as AnalysisErrorCode;
    const message =
      typeof e.message === 'string' && e.message.length <= 500 ? e.message : ERROR_MESSAGES[code];
    return { error: { code, message } };
  }
  const r = b.report as Partial<AnalysisReport> | undefined;
  if (
    !r ||
    typeof r !== 'object' ||
    r.schemaVersion !== 1 ||
    r.id !== id ||
    typeof r.url !== 'string' ||
    !Array.isArray(r.criteria) ||
    r.criteria.length > 500 ||
    !r.scores ||
    typeof r.scores !== 'object'
  ) {
    return null;
  }
  const screenshot =
    typeof b.screenshot === 'string' ? Buffer.from(b.screenshot, 'base64') : Buffer.alloc(0);
  if (screenshot.length > 0 && !screenshot.subarray(0, 3).equals(JPEG_MAGIC)) return null;
  return {
    report: { ...(r as AnalysisReport), hasScreenshot: screenshot.length > 0 },
    screenshot,
  };
}
