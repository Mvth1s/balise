/**
 * `pnpm demo:build`: regenerates the versioned demo reports
 * (apps/web/src/demo/reports/{avant,apres}.json) by running the real engine
 * on /demo/avant and /demo/apres served from the local build (apps/web/dist).
 * The npm script runs `pnpm build` first (Node loads the analyzer's dist).
 * Requires a local Chromium: pnpm exec playwright install chromium
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzePage } from '@balise/analyzer';
import {
  assertWebBuild,
  DEMO_REPORTS_DIR,
  DEMO_VARIANTS,
  normalizeDemoReport,
  serveStatic,
} from '../packages/analyzer/src/test-utils/demo-site.ts';

await assertWebBuild();
const site = await serveStatic();
try {
  for (const variant of DEMO_VARIANTS) {
    // allowPrivateHosts: local build only, reserved to this script and tests.
    const { report } = await analyzePage(`${site.origin}/demo/${variant}`, {
      allowPrivateHosts: true,
    });
    const normalized = normalizeDemoReport(report, variant);
    await writeFile(
      join(DEMO_REPORTS_DIR, `${variant}.json`),
      `${JSON.stringify(normalized, null, 2)}\n`,
    );
    const { global } = normalized.scores;
    console.log(
      `${variant}: score ${global.score ?? 'n/a'}, ${global.nonConformes} non conforme(s), ${global.conformes} conforme(s)`,
    );
  }
} finally {
  await site.close();
}
