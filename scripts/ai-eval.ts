/**
 * Reliability of the AI layer: analyses the pages of server/ai/eval/pages.ts
 * with the real engine and Mistral, then compares with the expected verdicts.
 *
 *   MISTRAL_API_KEY=… pnpm build && node --experimental-strip-types scripts/ai-eval.ts
 *
 * Requires a local Chromium (pnpm exec playwright install chromium). The pages
 * are fictitious: nothing personal is sent to Mistral.
 */
import http from 'node:http';
import { analyzePage } from '@balise/analyzer';
import { enrichWithAi } from '../server/ai/judge.ts';
import { EVAL_PAGES } from '../server/ai/eval/pages.ts';

if (!process.env.MISTRAL_API_KEY) {
  console.error('MISTRAL_API_KEY manquant : évaluation impossible.');
  process.exit(1);
}
const server = http.createServer((req, res) => {
  const page = EVAL_PAGES.find((p) => p.path === req.url);
  if (!page) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(
    `<!doctype html><html lang="${page.lang ?? 'fr'}"><head><meta charset="utf-8"><title>${page.title}</title></head><body><main>${page.body}</main></body></html>`,
  );
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

let ok = 0;
let wrong = 0;
let missing = 0;
for (const page of EVAL_PAGES) {
  const { report, pack } = await analyzePage(`${origin}${page.path}`, {
    allowPrivateHosts: true,
    interactions: { budgetMs: 0 },
  } as Parameters<typeof analyzePage>[1]);
  const judged = await enrichWithAi(report, pack, process.env, {
    log: (m, e) => console.error(m, e),
  });
  for (const [id, expected] of Object.entries(page.expected)) {
    const c = judged.criteria.find((x) => x.id === id)!;
    const got =
      c.status === 'conforme-ia'
        ? 'conforme'
        : c.status === 'non-conforme-ia'
          ? 'non-conforme'
          : null;
    const mark = got === null ? '∅' : got === expected ? '✓' : '✗';
    if (got === null) missing += 1;
    else if (got === expected) ok += 1;
    else wrong += 1;
    console.log(
      `${mark} ${page.path} ${id} attendu=${expected} obtenu=${got ?? c.status}${c.ai ? ` (${c.ai.confidence}) ${c.ai.justification}` : ''}`,
    );
  }
}
const total = ok + wrong + missing;
console.log(
  `\nJustes : ${ok}/${total}, faux : ${wrong}, non jugés : ${missing}. Précision sur les jugés : ${ok + wrong ? Math.round((100 * ok) / (ok + wrong)) : 0} %.`,
);
server.close();
