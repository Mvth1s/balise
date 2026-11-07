/// <reference lib="dom" />
import type { CheckFn, CheckResult, DescribeFn } from './types.js';

/*
 * Error-detection checks for criteria that can be failed automatically.
 * Each function runs inside the analysed page: it MUST be self-contained
 * (no closure, no import, helpers declared inside). A `pass` never proves the
 * criterion compliant; every mapping below is `partial` except 8.1.
 */

/** RGAA 8.1: the page has an HTML doctype declared before <html>. */
export function checkDoctype(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-doctype';
  const dt = doc.doctype;
  if (dt && dt.name.toLowerCase() === 'html' && doc.firstElementChild === doc.documentElement) {
    return { rule, outcome: 'pass', nodes: [] };
  }
  const root = describe(doc.documentElement);
  return {
    rule,
    outcome: 'fail',
    nodes: [{ selector: root.selector, html: root.html.slice(0, root.html.indexOf('>') + 1) }],
  };
}

/** RGAA 8.2: id attributes are unique. */
export function checkDuplicateId(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-duplicate-id';
  const seen = new Map<string, Element[]>();
  for (const el of Array.from(doc.querySelectorAll('[id]'))) {
    const id = el.getAttribute('id') ?? '';
    if (!id) continue;
    seen.set(id, [...(seen.get(id) ?? []), el]);
  }
  if (seen.size === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const dup = Array.from(seen.values()).filter((els) => els.length > 1);
  return dup.length
    ? { rule, outcome: 'fail', nodes: dup.slice(0, 20).map((els) => describe(els[1] as Element)) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 10.1 (tests 10.1.1 and 10.1.2): presentational elements and attributes. */
export function checkPresentationMarkup(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-presentation-markup';
  const ELEMENTS = new Set([
    'basefont',
    'big',
    'blink',
    'center',
    'font',
    'marquee',
    's',
    'strike',
    'tt',
  ]);
  const ATTRS = [
    'align',
    'alink',
    'background',
    'bgcolor',
    'border',
    'cellpadding',
    'cellspacing',
    'char',
    'charoff',
    'clear',
    'color',
    'compact',
    'frameborder',
    'hspace',
    'link',
    'marginheight',
    'marginwidth',
    'text',
    'valign',
    'vlink',
    'vspace',
  ];
  const SIZED = new Set([
    'img',
    'object',
    'embed',
    'canvas',
    'svg',
    'video',
    'iframe',
    'source',
    'input',
  ]);
  const bad: Element[] = [];
  for (const el of Array.from(doc.body?.querySelectorAll('*') ?? [])) {
    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    const tag = el.tagName.toLowerCase();
    if (
      ELEMENTS.has(tag) ||
      ATTRS.some((a) => el.hasAttribute(a)) ||
      (!SIZED.has(tag) && (el.hasAttribute('width') || el.hasAttribute('height'))) ||
      (tag !== 'select' && tag !== 'input' && el.hasAttribute('size'))
    ) {
      bad.push(el);
    }
  }
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 8.10 (test 8.10.2): dir values are valid. */
export function checkDirValid(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-dir-valid';
  const els = Array.from(doc.querySelectorAll('[dir]'));
  if (els.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const bad = els.filter(
    (el) => !['ltr', 'rtl', 'auto'].includes((el.getAttribute('dir') ?? '').trim().toLowerCase()),
  );
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 8.6: the page title is not a placeholder or a file name. */
export function checkTitleRelevant(doc: Document): CheckResult {
  const rule = 'balise-page-title-relevant';
  const title = (doc.title ?? '').replace(/\s+/g, ' ').trim();
  if (!title) return { rule, outcome: 'inapplicable', nodes: [] };
  const GENERIC =
    /^(sans titre|untitled( document)?|document|page|nouvelle page|new page|accueil|home|index|titre|title|welcome|bienvenue|react app|vite app|vue app)$/i;
  const FILE = /^(https?:\/\/\S+|\S+\.(html?|php|aspx?|jsp))$/i;
  const fail = GENERIC.test(title) || FILE.test(title);
  return {
    rule,
    outcome: fail ? 'fail' : 'pass',
    nodes: fail
      ? [{ selector: 'head > title', html: `<title>${title.slice(0, 200)}</title>` }]
      : [],
  };
}

/** RGAA 6.1: generic link text ("cliquez ici", "en savoir plus") without context. */
export function checkGenericLinks(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-link-generic';
  const GENERIC =
    /^(ici|cliquez ici|cliquer ici|clic ici|lire la suite|la suite|suite|en savoir plus|savoir plus|plus|voir|voir plus|lien|cette page|click here|here|read more|more|learn more|link)$/i;
  const norm = (s: string | null | undefined): string =>
    (s ?? '')
      .replace(/\s+/g, ' ')
      .replace(/[.…:»›>→\s]+$/u, '')
      .trim();
  const links = Array.from(doc.querySelectorAll('a[href], [role="link"]'));
  if (links.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const bad = links.filter((a) => {
    const text = norm(
      a.getAttribute('aria-label') ||
        (a.textContent ?? '') +
          Array.from(a.querySelectorAll('img[alt]'))
            .map((i) => i.getAttribute('alt'))
            .join(' '),
    );
    if (!GENERIC.test(text) || a.hasAttribute('aria-labelledby')) return false;
    const title = norm(a.getAttribute('title'));
    if (title && title.length > text.length) return false;
    // Context accepted by RGAA (sentence, paragraph, list item, cell).
    const ctx = a.parentElement?.closest('p, li, td, th, dd');
    return !ctx || norm(ctx.textContent).length <= text.length + 2;
  });
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 5.6: a table presented as a data table (caption, thead, label) declares headers. */
export function checkDataTableHeaders(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-data-table-headers';
  const tables = Array.from(doc.querySelectorAll('table, [role="table"], [role="grid"]')).filter(
    (t) => !['presentation', 'none'].includes((t.getAttribute('role') ?? '').toLowerCase()),
  );
  const data = tables.filter(
    (t) =>
      t.getAttribute('role') === 'table' ||
      t.getAttribute('role') === 'grid' ||
      t.querySelector(':scope > caption, :scope > thead') !== null ||
      t.hasAttribute('aria-label') ||
      t.hasAttribute('aria-labelledby'),
  );
  if (data.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const bad = data.filter(
    (t) => t.querySelector('th, [role="columnheader"], [role="rowheader"]') === null,
  );
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 5.8: a layout table (role presentation/none) uses no data-table markup. */
export function checkLayoutTable(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-layout-table';
  const tables = Array.from(doc.querySelectorAll('table')).filter((t) =>
    ['presentation', 'none'].includes((t.getAttribute('role') ?? '').toLowerCase()),
  );
  if (tables.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const bad = tables.filter(
    (t) =>
      t.hasAttribute('summary') ||
      t.querySelector(
        ':scope > caption, :scope > thead, :scope > tfoot, th, [scope], [headers], [axis]',
      ) !== null,
  );
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 1.2: a decorative image (alt="", aria-hidden, role none) carries no text alternative. */
export function checkDecorativeImages(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-decorative-img';
  const decorative = Array.from(
    doc.querySelectorAll(
      'img[alt=""], img[role="presentation"], img[role="none"], img[aria-hidden="true"], svg[aria-hidden="true"]',
    ),
  );
  if (decorative.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const filled = (el: Element, a: string): boolean => (el.getAttribute(a) ?? '').trim() !== '';
  const bad = decorative.filter(
    (el) =>
      filled(el, 'title') ||
      filled(el, 'aria-label') ||
      filled(el, 'aria-labelledby') ||
      filled(el, 'aria-describedby') ||
      (el.tagName.toLowerCase() === 'svg' &&
        Array.from(el.querySelectorAll('title, desc')).some((t) => (t.textContent ?? '').trim())),
  );
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/**
 * RGAA 1.3: the alternative is not a file name or a generic word, and an
 * image that is the only content of a link or button is not given alt="".
 */
export function checkImageAltRelevant(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-img-alt-relevant';
  const imgs = Array.from(doc.querySelectorAll('img[alt], input[type="image"][alt]'));
  if (imgs.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const FILE = /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i;
  const GENERIC =
    /^(image|img|photo|picture|icon|icône|icone|logo|graphique|illustration|spacer|dsc_?\d+|img_?\d+)$/i;
  const bad = imgs.filter((img) => {
    const alt = (img.getAttribute('alt') ?? '').trim();
    if (alt) return FILE.test(alt) || GENERIC.test(alt);
    const host = img.closest('a[href], button');
    if (!host || host.hasAttribute('aria-label') || host.hasAttribute('aria-labelledby')) {
      return false;
    }
    const text = (host.textContent ?? '').trim();
    const otherAlt = Array.from(host.querySelectorAll('img[alt]')).some(
      (i) => (i.getAttribute('alt') ?? '').trim() !== '',
    );
    return !text && !otherAlt && !(host.getAttribute('title') ?? '').trim();
  });
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 11.1: every form field has a label (a placeholder alone is not one). */
export function checkFieldLabels(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-field-label';
  const fields = Array.from(doc.querySelectorAll('input, select, textarea')).filter((el) => {
    const type = (el.getAttribute('type') ?? '').toLowerCase();
    return !['hidden', 'submit', 'button', 'reset', 'image'].includes(type);
  });
  if (fields.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const bad = fields.filter((el) => {
    if ((el.getAttribute('aria-label') ?? '').trim()) return false;
    if ((el.getAttribute('title') ?? '').trim()) return false;
    const ids = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    if (ids.some((id) => (doc.getElementById(id)?.textContent ?? '').trim())) return false;
    const labels = (el as HTMLInputElement).labels;
    return !labels || !Array.from(labels).some((l) => (l.textContent ?? '').trim());
  });
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 11.5: radio buttons sharing a name are grouped (fieldset or role group/radiogroup). */
export function checkRadioGroups(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-radio-group';
  const byName = new Map<string, Element[]>();
  for (const r of Array.from(doc.querySelectorAll('input[type="radio"][name]'))) {
    const name = r.getAttribute('name') ?? '';
    byName.set(name, [...(byName.get(name) ?? []), r]);
  }
  const groups = Array.from(byName.values()).filter((g) => g.length > 1);
  if (groups.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const bad = groups.filter(
    (g) => !(g[0] as Element).closest('fieldset, [role="group"], [role="radiogroup"]'),
  );
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map((g) => describe(g[0] as Element)) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 11.6: every field group (fieldset, role group/radiogroup) has a legend. */
export function checkGroupLegends(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-group-legend';
  const groups = Array.from(doc.querySelectorAll('fieldset, [role="group"], [role="radiogroup"]'));
  if (groups.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const bad = groups.filter((g) => {
    if ((g.getAttribute('aria-label') ?? '').trim()) return false;
    const ids = (g.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    if (ids.some((id) => (doc.getElementById(id)?.textContent ?? '').trim())) return false;
    const legend =
      g.tagName.toLowerCase() === 'fieldset' ? g.querySelector(':scope > legend') : null;
    return !(legend?.textContent ?? '').trim();
  });
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/** RGAA 8.9: no empty paragraph used only for spacing. */
export function checkEmptyParagraphs(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-empty-paragraph';
  const ps = Array.from(doc.querySelectorAll('body p'));
  if (ps.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const bad = ps.filter(
    (p) =>
      (p.textContent ?? '').replace(/[\s\u00a0]+/g, '') === '' &&
      Array.from(p.children).every((c) => c.tagName.toLowerCase() === 'br'),
  );
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

/**
 * RGAA 10.7: focusing an element changes its rendering. Compares the computed
 * style before and after focus(); elements with transitions are skipped (their
 * computed style lags). Restores the previous focus.
 */
export function checkFocusVisible(doc: Document, describe: DescribeFn): CheckResult {
  const rule = 'balise-focus-visible';
  const view = doc.defaultView;
  if (!view) return { rule, outcome: 'incomplete', nodes: [] };
  const candidates = Array.from(
    doc.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex="0"]',
    ),
  )
    .filter((el) => {
      const h = el as HTMLElement;
      if (h.hasAttribute('disabled') || h.closest('[inert], [aria-hidden="true"]')) return false;
      const s = view.getComputedStyle(h);
      return s.visibility !== 'hidden' && s.display !== 'none' && h.getClientRects().length > 0;
    })
    .slice(0, 40);
  if (candidates.length === 0) return { rule, outcome: 'inapplicable', nodes: [] };
  const PROPS = [
    'outline-style',
    'outline-width',
    'outline-color',
    'box-shadow',
    'border-top-color',
    'border-bottom-color',
    'border-bottom-width',
    'background-color',
    'color',
    'text-decoration-line',
    'text-decoration-thickness',
  ];
  const snap = (el: Element): string => {
    const s = view.getComputedStyle(el);
    return PROPS.map((p) => s.getPropertyValue(p)).join('|');
  };
  const previous = doc.activeElement as HTMLElement | null;
  const bad: Element[] = [];
  let tested = 0;
  for (const el of candidates) {
    const s = view.getComputedStyle(el);
    if (s.transitionDuration.split(',').some((d) => parseFloat(d) > 0)) continue;
    const before = snap(el);
    (el as HTMLElement).focus({ preventScroll: true });
    if (doc.activeElement !== el) continue;
    tested += 1;
    if (snap(el) === before) bad.push(el);
    (el as HTMLElement).blur();
  }
  previous?.focus?.({ preventScroll: true });
  if (tested === 0) return { rule, outcome: 'incomplete', nodes: [] };
  return bad.length
    ? { rule, outcome: 'fail', nodes: bad.slice(0, 20).map(describe) }
    : { rule, outcome: 'pass', nodes: [] };
}

export const EXTRA_CHECKS: ReadonlyArray<{ rule: string; fn: CheckFn }> = [
  { rule: 'balise-doctype', fn: checkDoctype },
  { rule: 'balise-duplicate-id', fn: checkDuplicateId },
  { rule: 'balise-presentation-markup', fn: checkPresentationMarkup },
  { rule: 'balise-dir-valid', fn: checkDirValid },
  { rule: 'balise-page-title-relevant', fn: checkTitleRelevant },
  { rule: 'balise-link-generic', fn: checkGenericLinks },
  { rule: 'balise-data-table-headers', fn: checkDataTableHeaders },
  { rule: 'balise-layout-table', fn: checkLayoutTable },
  { rule: 'balise-decorative-img', fn: checkDecorativeImages },
  { rule: 'balise-img-alt-relevant', fn: checkImageAltRelevant },
  { rule: 'balise-field-label', fn: checkFieldLabels },
  { rule: 'balise-radio-group', fn: checkRadioGroups },
  { rule: 'balise-group-legend', fn: checkGroupLegends },
  { rule: 'balise-empty-paragraph', fn: checkEmptyParagraphs },
  // Last: moves the focus around.
  { rule: 'balise-focus-visible', fn: checkFocusVisible },
];
