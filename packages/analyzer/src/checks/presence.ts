/// <reference lib="dom" />
import type { ElementKind } from '@balise/rgaa-mapping';

export type Presence = Record<ElementKind, boolean>;

export const ELEMENT_KINDS: readonly ElementKind[] = [
  'images',
  'captcha',
  'frames',
  'timedMedia',
  'nonTimedMedia',
  'tables',
  'links',
  'scripts',
  'fields',
  'choiceLists',
  'buttons',
  'search',
  'officeDocs',
  'rtlText',
  'crypticText',
];

/** French labels used in the report ("aucun … détecté"). */
export const ELEMENT_KIND_LABELS: Readonly<Record<ElementKind, string>> = {
  images: 'image',
  captcha: 'CAPTCHA',
  frames: 'cadre',
  timedMedia: 'média temporel (vidéo, audio)',
  nonTimedMedia: 'média non temporel (object, embed)',
  tables: 'tableau',
  links: 'lien',
  scripts: 'script',
  fields: 'champ de formulaire',
  choiceLists: 'liste de choix',
  buttons: 'bouton',
  search: 'moteur de recherche',
  officeDocs: 'document bureautique en téléchargement',
  rtlText: 'texte de droite à gauche',
  crypticText: 'émoticône ou contenu cryptique',
};

/**
 * Detects which kinds of elements exist in one document (and its open shadow
 * roots). ARIA equivalents count (role="table", "grid", "textbox"…). Runs in
 * the page: self-contained, no closure.
 */
export function detectPresence(doc: Document): Presence {
  const roots: Array<Document | ShadowRoot> = [doc];
  for (let i = 0; i < roots.length; i += 1) {
    for (const el of Array.from(roots[i]!.querySelectorAll('*'))) {
      if (el.shadowRoot) roots.push(el.shadowRoot);
    }
  }
  const all = (selector: string): Element[] =>
    roots.flatMap((r) => Array.from(r.querySelectorAll(selector)));
  const has = (selector: string): boolean => all(selector).length > 0;

  const MEDIA_HOST =
    /youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly|soundcloud\.com|spotify\.com|deezer\.com|twitch\.tv|ted\.com|podcast|ausha|acast|wistia|brightcove|jwplayer|kaltura|vidyard|arte\.tv|francetv|ina\.fr|player|video|audio|media/i;
  const MEDIA_TYPE = /^(video|audio)\//i;
  const MEDIA_EXT = /\.(mp4|webm|ogv|ogg|mp3|m4a|wav|flac|aac|mov|m3u8|mpd)(\?|#|$)/i;
  const timedMedia =
    has('video, audio, [role="application"][aria-roledescription*="vid" i]') ||
    all('iframe[src], frame[src]').some((f) => MEDIA_HOST.test(f.getAttribute('src') ?? '')) ||
    all('object, embed').some(
      (o) =>
        MEDIA_TYPE.test(o.getAttribute('type') ?? '') ||
        MEDIA_EXT.test(o.getAttribute('data') ?? o.getAttribute('src') ?? ''),
    );
  const nonTimedMedia =
    has('applet') ||
    all('object, embed').some((o) => {
      const type = o.getAttribute('type') ?? '';
      const src = o.getAttribute('data') ?? o.getAttribute('src') ?? '';
      return !/^image\//i.test(type) && !MEDIA_TYPE.test(type) && !MEDIA_EXT.test(src);
    });

  const scripts =
    has(
      'script:not([type]), script[type=""], script[type="module"], script[type*="javascript" i], script[type*="ecmascript" i], a[href^="javascript:" i]',
    ) || all('*').some((el) => Array.from(el.attributes).some((a) => /^on[a-z]+$/i.test(a.name)));

  // Visible text only (no script/style), for RTL and cryptic content.
  const texts: string[] = [];
  for (const root of roots) {
    const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement?.tagName.toLowerCase() ?? '';
      if (!['script', 'style', 'noscript', 'template'].includes(parent))
        texts.push(n.nodeValue ?? '');
    }
  }
  const text = texts.join(' ');

  return {
    images: has(
      'img, picture, svg, canvas, area, [role="img"], input[type="image" i], object[type^="image/" i], embed[type^="image/" i]',
    ),
    captcha: has(
      '[src*="captcha" i], [id*="captcha" i], [class*="captcha" i], [name*="captcha" i], iframe[src*="recaptcha" i], iframe[src*="hcaptcha" i], iframe[src*="challenges.cloudflare.com" i], .cf-turnstile, [data-sitekey]',
    ),
    frames: has('iframe, frame'),
    timedMedia,
    nonTimedMedia,
    tables: has('table, [role="table"], [role="grid"], [role="treegrid"]'),
    links: has('a[href], area[href], [role="link"]'),
    scripts,
    fields: has(
      'input:not([type="hidden" i]):not([type="submit" i]):not([type="button" i]):not([type="reset" i]):not([type="image" i]), select, textarea, [contenteditable=""], [contenteditable="true" i], [role="textbox"], [role="searchbox"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"], [role="radiogroup"], [role="switch"], [role="slider"], [role="spinbutton"]',
    ),
    choiceLists: has('select, datalist, [role="listbox"]'),
    buttons: has(
      'button, input[type="submit" i], input[type="button" i], input[type="reset" i], input[type="image" i], [role="button"]',
    ),
    search: has(
      'input[type="search" i], [role="search"], search, [role="searchbox"], form[action*="search" i], form[action*="recherche" i], input[name="q"], input[name*="search" i], input[name*="recherche" i]',
    ),
    officeDocs: all('a[href], area[href]').some((a) =>
      /\.(pdf|docx?|odt|xlsx?|ods|pptx?|odp|rtf|epub)(\?|#|$)/i.test(a.getAttribute('href') ?? ''),
    ),
    rtlText: has('[dir="rtl" i]') || /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(text),
    crypticText:
      /\p{Extended_Pictographic}/u.test(text) ||
      /(^|\s)[:;=8xX][-^'o]?[)(\][DPpOo|/\\*]($|\s)/.test(text) ||
      /[\u2500-\u259F]{3,}/.test(text) ||
      /([^\w\s])\1{5,}/.test(text),
  };
}

/** ORs the presence of several documents (main page and frames). */
export function mergePresence(list: readonly Presence[]): Presence {
  const out = Object.fromEntries(ELEMENT_KINDS.map((k) => [k, false])) as Presence;
  for (const p of list) for (const k of ELEMENT_KINDS) out[k] ||= p[k] === true;
  return out;
}

/** Untrusted value from the page → Presence, or null when malformed. */
export function sanitizePresence(value: unknown): Presence | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!ELEMENT_KINDS.every((k) => typeof v[k] === 'boolean')) return null;
  return Object.fromEntries(ELEMENT_KINDS.map((k) => [k, v[k]])) as Presence;
}
