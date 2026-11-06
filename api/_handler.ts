/**
 * Shared Vercel wiring (the `_` prefix keeps this file from being deployed
 * as a function). Chromium comes from @sparticuz/chromium on Vercel, see
 * packages/analyzer/src/browser.ts; Upstash credentials and RATE_LIMIT_SALT
 * come from the environment.
 */
import { waitUntil } from '@vercel/functions';
import { createHandlers } from '../server/handlers.ts';

export const handle = createHandlers({ env: process.env, waitUntil });
