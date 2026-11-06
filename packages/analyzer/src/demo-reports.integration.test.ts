/**
 * Non-regression: re-runs the engine on the demo pages of the web build and
 * compares with the versioned reports (apps/web/src/demo/reports). Needs
 * `pnpm build` (apps/web/dist) and a local Chromium.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { analyzePage } from './analyze.js';
import {
  assertWebBuild,
  DEMO_REBUILD_HINT,
  DEMO_REPORTS_DIR,
  DEMO_VARIANTS,
  demoSignature,
  normalizeDemoReport,
  serveStatic,
} from './test-utils/demo-site.js';
import type { AnalysisReport } from './types.js';

let site: Awaited<ReturnType<typeof serveStatic>>;

beforeAll(async () => {
  await assertWebBuild();
  site = await serveStatic();
});
afterAll(() => site?.close());

describe('demo reports', () => {
  it.each(DEMO_VARIANTS)(
    'matches the versioned report for /demo/%s',
    async (variant) => {
      const { report } = await analyzePage(`${site.origin}/demo/${variant}`, {
        allowPrivateHosts: true,
      });
      const expected = JSON.parse(
        await readFile(join(DEMO_REPORTS_DIR, `${variant}.json`), 'utf8'),
      ) as AnalysisReport;
      expect(
        demoSignature(normalizeDemoReport(report, variant)),
        `Le rapport de /demo/${variant} a changé : ${DEMO_REBUILD_HINT}.`,
      ).toEqual(demoSignature(expected));
    },
    60_000,
  );
});
