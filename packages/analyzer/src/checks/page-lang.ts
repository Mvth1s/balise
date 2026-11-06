/// <reference lib="dom" />
import type { CheckResult, DescribeFn } from './types.js';

export const PAGE_LANG_RULE = 'balise-page-lang';

/** RGAA 8.3 / 8.4: <html> declares a valid language code. Self-contained. */
export function checkPageLang(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-page-lang';
  const html = doc.documentElement;
  const lang = (html.getAttribute('lang') ?? html.getAttribute('xml:lang') ?? '').trim();
  const valid = /^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i.test(lang);
  const snippet = describe(html);
  const node = {
    selector: snippet.selector,
    html: snippet.html.slice(0, snippet.html.indexOf('>') + 1) || snippet.html,
  };
  return { rule, outcome: valid ? 'pass' : 'fail', nodes: [node] };
}
