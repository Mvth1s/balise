// POST /api/run — isolated Chromium worker (no storage credential, see server/worker.ts).
import { analyzePage, launchBrowser } from '@balise/analyzer';
import { waitUntil } from '@vercel/functions';
import { fileURLToPath } from 'node:url';
import { createWorkerHandler } from '../../server/worker.ts';

// Copied by the build command next to this function (vercel.json includeFiles).
const sparticuzBinDir = fileURLToPath(new URL('../chromium', import.meta.url));

export const POST = createWorkerHandler({
  env: process.env,
  waitUntil,
  analyze: (url, options) =>
    analyzePage(url, { ...options, launch: () => launchBrowser({ sparticuzBinDir }) }),
});
