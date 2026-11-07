/// <reference lib="dom" />
/**
 * Elements sent for AI judgement (relevance criteria a machine rule cannot
 * decide). Collected in the page by the engine — in the isolated worker in
 * production — then judged by the API, which alone holds MISTRAL_API_KEY.
 * Everything here comes from the analysed page: untrusted, size-capped.
 */
import type { Page } from 'playwright-core';
import { describeElement } from './checks/describe.js';

export interface JudgeImage {
  selector: string;
  /** null = no alt attribute; "" = declared decorative. */
  alt: string | null;
  /** Text of the link or button the image is in, if any. */
  inControl: string | null;
  context: string;
  /** JPEG crop, base64 (empty when the image is off-screen or too small). */
  jpeg: string;
}

export interface JudgePack {
  url: string;
  title: string;
  lang: string | null;
  images: JudgeImage[];
  links: Array<{ selector: string; text: string; href: string; context: string }>;
  headings: Array<{ selector: string; level: number; text: string; next: string }>;
  fields: Array<{ selector: string; label: string; type: string; hint: string }>;
  buttons: Array<{ selector: string; name: string }>;
  frames: Array<{ selector: string; title: string; src: string }>;
  tables: Array<{ selector: string; caption: string; headers: string; firstRow: string }>;
  passages: Array<{ selector: string; lang: string | null; text: string }>;
}

export const JUDGE_LIMITS = {
  images: 8,
  links: 40,
  headings: 60,
  fields: 30,
  buttons: 30,
  frames: 10,
  tables: 5,
  passages: 30,
  text: 200,
  imageBytes: 120_000,
} as const;

/** Runs in the page (self-contained). */
function collect(describe: (el: Element) => { selector: string }, L: typeof JUDGE_LIMITS) {
  const clean = (s: string | null | undefined, n: number = L.text): string =>
    (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const context = (el: Element): string =>
    clean(
      el.closest('figure')?.querySelector('figcaption')?.textContent ||
        el.closest('p, li, td, th, dd, figure, article, section')?.textContent ||
        el.parentElement?.textContent,
    );
  const nameOf = (el: Element): string => {
    const lb = (el.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    const imgs = Array.from(el.querySelectorAll('img[alt]'))
      .map((i) => i.getAttribute('alt'))
      .join(' ');
    return clean(
      el.getAttribute('aria-label') ||
        lb ||
        `${el.textContent ?? ''} ${imgs}` ||
        el.getAttribute('title'),
    );
  };
  const take = <T>(list: Element[], n: number, map: (el: Element) => T): T[] =>
    list.filter(visible).slice(0, n).map(map);

  const images = take(
    Array.from(
      document.querySelectorAll(
        'img, [role="img"], input[type="image"], svg[aria-label], svg[aria-labelledby]',
      ),
    ),
    L.images * 3,
    (el) => {
      const r = el.getBoundingClientRect();
      const control = el.closest('a[href], button');
      return {
        selector: describe(el).selector,
        alt: el.hasAttribute('alt') ? el.getAttribute('alt') : el.getAttribute('aria-label'),
        inControl: control ? clean(control.textContent) : null,
        context: context(el),
        box: { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height },
      };
    },
  ).filter((i) => i.box.width >= 24 && i.box.height >= 24);

  return {
    url: location.href,
    title: clean(document.title),
    lang: document.documentElement.getAttribute('lang'),
    images: images.slice(0, L.images),
    links: take(Array.from(document.querySelectorAll('a[href], [role="link"]')), L.links, (el) => ({
      selector: describe(el).selector,
      text: nameOf(el),
      href: clean(el.getAttribute('href'), 120),
      context: context(el),
    })),
    headings: take(
      Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')),
      L.headings,
      (el) => {
        let next = '';
        for (let n = el.nextElementSibling; n && next.length < 120; n = n.nextElementSibling)
          next += ` ${n.textContent ?? ''}`;
        return {
          selector: describe(el).selector,
          level: Number(el.getAttribute('aria-level') || el.tagName.slice(1)) || 2,
          text: clean(el.textContent),
          next: clean(next, 120),
        };
      },
    ),
    fields: take(
      Array.from(
        document.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea, [role="textbox"], [role="combobox"]',
        ),
      ),
      L.fields,
      (el) => {
        const labels = (el as HTMLInputElement).labels;
        return {
          selector: describe(el).selector,
          label: clean(
            el.getAttribute('aria-label') ||
              (labels
                ? Array.from(labels)
                    .map((l) => l.textContent)
                    .join(' ')
                : '') ||
              el.getAttribute('title'),
          ),
          type: clean(el.getAttribute('type') || el.tagName.toLowerCase(), 30),
          hint: clean(
            `${el.getAttribute('placeholder') ?? ''} ${el.getAttribute('autocomplete') ?? ''} ${el.getAttribute('name') ?? ''}`,
            100,
          ),
        };
      },
    ),
    buttons: take(
      Array.from(
        document.querySelectorAll(
          'button, input[type="submit"], input[type="button"], [role="button"]',
        ),
      ),
      L.buttons,
      (el) => ({
        selector: describe(el).selector,
        name: nameOf(el) || clean(el.getAttribute('value')),
      }),
    ),
    frames: Array.from(document.querySelectorAll('iframe, frame'))
      .slice(0, L.frames)
      .map((el) => ({
        selector: describe(el).selector,
        title: clean(el.getAttribute('title')),
        src: clean(el.getAttribute('src'), 120),
      })),
    tables: take(
      Array.from(document.querySelectorAll('table, [role="table"]')),
      L.tables,
      (el) => ({
        selector: describe(el).selector,
        caption: clean(el.querySelector('caption')?.textContent || el.getAttribute('aria-label')),
        headers: clean(
          Array.from(el.querySelectorAll('th'))
            .map((t) => t.textContent)
            .join(' | '),
        ),
        firstRow: clean(el.querySelector('tr:not(:has(th))')?.textContent),
      }),
    ),
    passages: take(
      Array.from(document.querySelectorAll('p, li, blockquote, q, td, dd, figcaption, h1, h2, h3')),
      400,
      (el) => ({
        selector: describe(el).selector,
        lang: el.closest('[lang]')?.getAttribute('lang') ?? null,
        text: clean(el.textContent),
      }),
    )
      .filter((p) => p.text.length >= 25)
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, L.passages),
  };
}

/** Collects the pack, with JPEG crops of the images. Never throws: returns null. */
export async function collectJudgePack(page: Page): Promise<JudgePack | null> {
  try {
    const raw = (await page.evaluate(
      `(${collect.toString()})((${describeElement.toString()}), ${JSON.stringify(JUDGE_LIMITS)})`,
    )) as Omit<JudgePack, 'images'> & {
      images: Array<
        Omit<JudgeImage, 'jpeg'> & { box: { x: number; y: number; width: number; height: number } }
      >;
    };
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.images)) return null;
    const images: JudgeImage[] = [];
    for (const { box, ...img } of raw.images) {
      let jpeg = '';
      try {
        const clip = {
          x: box.x,
          y: box.y,
          width: Math.min(box.width, 800),
          height: Math.min(box.height, 800),
        };
        const buf = await page.screenshot({
          clip,
          fullPage: true,
          type: 'jpeg',
          quality: 50,
          scale: 'css',
          animations: 'disabled',
        });
        if (buf.length <= JUDGE_LIMITS.imageBytes) jpeg = buf.toString('base64');
      } catch {
        jpeg = '';
      }
      images.push({ ...img, jpeg });
    }
    return sanitizeJudgePack({ ...raw, images });
  } catch {
    return null;
  }
}

const str = (v: unknown, n: number): string => (typeof v === 'string' ? v.slice(0, n) : '');
const list = <T>(v: unknown, n: number, map: (o: Record<string, unknown>) => T): T[] =>
  Array.isArray(v)
    ? v
        .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
        .slice(0, n)
        .map(map)
    : [];

/** Re-validates a pack received from the page or from the worker (untrusted). */
export function sanitizeJudgePack(value: unknown): JudgePack | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const L = JUDGE_LIMITS;
  const sel = (o: Record<string, unknown>) => str(o.selector, 1000);
  return {
    url: str(v.url, 2000),
    title: str(v.title, L.text),
    lang: typeof v.lang === 'string' ? v.lang.slice(0, 35) : null,
    images: list(v.images, L.images, (o) => {
      const jpeg = str(o.jpeg, Math.ceil((L.imageBytes * 4) / 3) + 4);
      return {
        selector: sel(o),
        alt: typeof o.alt === 'string' ? o.alt.slice(0, 500) : null,
        inControl: typeof o.inControl === 'string' ? o.inControl.slice(0, L.text) : null,
        context: str(o.context, L.text),
        jpeg: /^[A-Za-z0-9+/]*={0,2}$/.test(jpeg) ? jpeg : '',
      };
    }),
    links: list(v.links, L.links, (o) => ({
      selector: sel(o),
      text: str(o.text, L.text),
      href: str(o.href, 120),
      context: str(o.context, L.text),
    })),
    headings: list(v.headings, L.headings, (o) => ({
      selector: sel(o),
      level: Math.min(6, Math.max(1, Math.round(Number(o.level)) || 2)),
      text: str(o.text, L.text),
      next: str(o.next, 120),
    })),
    fields: list(v.fields, L.fields, (o) => ({
      selector: sel(o),
      label: str(o.label, L.text),
      type: str(o.type, 30),
      hint: str(o.hint, 100),
    })),
    buttons: list(v.buttons, L.buttons, (o) => ({ selector: sel(o), name: str(o.name, L.text) })),
    frames: list(v.frames, L.frames, (o) => ({
      selector: sel(o),
      title: str(o.title, L.text),
      src: str(o.src, 120),
    })),
    tables: list(v.tables, L.tables, (o) => ({
      selector: sel(o),
      caption: str(o.caption, L.text),
      headers: str(o.headers, L.text),
      firstRow: str(o.firstRow, L.text),
    })),
    passages: list(v.passages, L.passages, (o) => ({
      selector: sel(o),
      lang: typeof o.lang === 'string' ? o.lang.slice(0, 35) : null,
      text: str(o.text, L.text),
    })),
  };
}
