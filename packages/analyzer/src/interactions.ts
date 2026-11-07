/// <reference lib="dom" />
/**
 * Interaction tests run with Playwright on the loaded page (in the isolated
 * worker in production): keyboard walk, hover, viewport and text changes,
 * idle observation. Each test yields one Balise rule result; a test that
 * crashes or runs out of time yields `incomplete` (criterion left to check).
 *
 * Criteria (RGAA 4.1.2, official titles): 10.4 text at 200 %, 10.7 focus
 * visible, 10.11 reflow at 320 px, 10.12 text spacing, 10.13 additional
 * content on hover/focus, 12.8 tab order, 12.9 keyboard trap, 13.1 time
 * limits (automatic refresh/redirect), 13.2 new windows, 13.8 moving
 * content, 13.9 orientation.
 */
import type { Frame, Page } from 'playwright-core';
import { describeElement } from './checks/describe.js';
import type { NormalizedRuleResult } from './results.js';
import type { FindingNode } from './types.js';

export const INTERACTION_RULES = [
  'balise-new-window',
  'balise-auto-refresh',
  'balise-moving-content',
  'balise-keyboard-trap',
  'balise-tab-order',
  'balise-focus-visible',
  'balise-hover-content',
  'balise-text-spacing',
  'balise-text-zoom',
  'balise-reflow',
  'balise-orientation',
] as const;
export type InteractionRule = (typeof INTERACTION_RULES)[number];

/** Events observed from before navigation (see `observePage`). */
export interface PageObservation {
  popups: string[];
  /** Main-frame navigations after `markLoaded()`. */
  navigationsAfterLoad: string[];
  markLoaded(): void;
  dispose(): void;
}

/** Starts recording popups and late navigations; call before navigating. */
export function observePage(page: Page): PageObservation {
  const popups: string[] = [];
  const navigationsAfterLoad: string[] = [];
  let loaded = false;
  // `popup` only fires for windows opened by this page (axe opens its own helper page).
  const onPage = (p: Page): void => {
    popups.push(p.url());
    void p.close().catch(() => undefined);
  };
  const onNav = (frame: Frame): void => {
    if (loaded && frame === page.mainFrame()) navigationsAfterLoad.push(frame.url());
  };
  page.on('popup', onPage);
  page.on('framenavigated', onNav);
  return {
    popups,
    navigationsAfterLoad,
    markLoaded: () => (loaded = true),
    dispose: () => {
      page.off('popup', onPage);
      page.off('framenavigated', onNav);
    },
  };
}

const MAX_NODES = 20;
const DESCRIBE = describeElement.toString();
type Outcome = NormalizedRuleResult['outcome'];

function result(rule: InteractionRule, outcome: Outcome, nodes: FindingNode[] = []) {
  const failures = outcome === 'fail' ? nodes.slice(0, MAX_NODES) : [];
  return {
    rule,
    engine: 'balise' as const,
    outcome,
    failures,
    passedCount: outcome === 'pass' ? 1 : 0,
  };
}

/** Runs a page function (self-contained source) with the describe helper. */
async function inPage<T>(page: Page | Frame, fn: string, arg: unknown = null): Promise<T> {
  return (await page.evaluate(`(${fn})((${DESCRIBE}), ${JSON.stringify(arg)})`)) as T;
}

const isNodes = (v: unknown): v is FindingNode[] =>
  Array.isArray(v) &&
  v.every((n) => n && typeof n.selector === 'string' && typeof n.html === 'string');
const clampNodes = (v: unknown): FindingNode[] =>
  isNodes(v)
    ? v
        .slice(0, MAX_NODES)
        .map((n) => ({ selector: n.selector.slice(0, 1000), html: n.html.slice(0, 1000) }))
    : [];

// ---------------------------------------------------------------- page code
// Functions below run in the page (serialised): no closure, no import.

/**
 * Marks visible text elements whose text is cut (overflow hidden/clip or
 * ellipsis with scroll size > box), or that are partially outside the
 * viewport on the right. Returns described offenders not marked before
 * (`baseline` = attribute value of the previous run, or null).
 */
const CLIPPED_TEXT = `function (describe, arg) {
  const mark = arg.mark, baseline = arg.baseline, edge = arg.edge;
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim().length > 1);
    if (!own) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // Icon-sized controls hide their text on purpose; line clamps and ellipses are designed truncations.
    if ((r.width <= 48 && r.height <= 48) || (Math.abs(r.width - r.height) <= 4 && el.matches('a, button, [role="button"]'))) continue;
    if (s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none')) continue;
    const clip = /hidden|clip/.test(s.overflowX + s.overflowY);
    let cut = clip && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2);
    if (edge && !cut && r.left < vw - 2 && r.right > vw + 2 && s.position !== 'fixed') {
      let exempt = false;
      for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX;
        // Scrollable areas, and components clipping their own content (carousels), are not the page.
        if (o !== 'visible') { exempt = true; break; }
        if (a.matches('table, pre, code, [role="grid"], [role="application"]')) { exempt = true; break; }
      }
      cut = !exempt;
    }
    if (!cut) continue;
    const seen = baseline !== null && el.getAttribute(baseline) === '1';
    el.setAttribute(mark, '1');
    if (!seen) out.push(describe(el));
    if (out.length >= 20) break;
  }
  return out;
}`;

const MOVING = `function (describe) {
  const big = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height >= 1000 && r.bottom > 0 && r.right > 0; };
  const moving = [];
  for (const a of document.getAnimations()) {
    const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
    const target = a.effect && a.effect.target;
    if (!t || !target || a.playState !== 'running' || !(target instanceof Element)) continue;
    const long = t.iterations === Infinity || (typeof t.activeDuration === 'number' && t.activeDuration > 5000);
    if (long && big(target)) moving.push(target);
  }
  for (const v of Array.from(document.querySelectorAll('video'))) {
    if (!v.paused && !v.controls && big(v) && (v.loop || v.duration > 5)) moving.push(v);
  }
  const unique = Array.from(new Set(moving));
  if (!unique.length) return { moving: [], control: false };
  const control = Array.from(document.querySelectorAll('button, [role="button"], a[href], input[type="button"]')).some((b) =>
    /pause|arr[êe]t|stop|play|lecture|animation/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.textContent || '')));
  return { moving: unique.slice(0, 20).map(describe), control };
}`;

/** Snapshot of the computed style of every focusable element, keyed by a marker. */
const FOCUS_SNAPSHOT = `function () {
  function focusLook(el, props) {
    const styles = [getComputedStyle(el), getComputedStyle(el, '::before'), getComputedStyle(el, '::after')];
    if (el.parentElement) styles.push(getComputedStyle(el.parentElement));
    if (el.parentElement && el.parentElement.parentElement) styles.push(getComputedStyle(el.parentElement.parentElement));
    return styles.map((st) => props.map((k) => st.getPropertyValue(k)).join('|')).join('#');
  }
  const props = ['outline-style','outline-width','outline-color','box-shadow','border-top-color','border-bottom-color','border-bottom-width','background-color','color','text-decoration-line','text-decoration-thickness','transform'];
  const sel = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, summary, [tabindex], [contenteditable=""], [contenteditable="true"]';
  let i = 0;
  for (const el of Array.from(document.querySelectorAll(sel))) {
    el.setAttribute('data-balise-f', String(i));
    el.setAttribute('data-balise-fs', focusLook(el, props));
    i += 1;
  }
  return i;
}`;

/** State of the focused element after a Tab press. */
const FOCUS_STATE = `function (describe) {
  function focusLook(el, props) {
    const styles = [getComputedStyle(el), getComputedStyle(el, '::before'), getComputedStyle(el, '::after')];
    if (el.parentElement) styles.push(getComputedStyle(el.parentElement));
    if (el.parentElement && el.parentElement.parentElement) styles.push(getComputedStyle(el.parentElement.parentElement));
    return styles.map((st) => props.map((k) => st.getPropertyValue(k)).join('|')).join('#');
  }
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { kind: 'none' };
  if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') return { kind: 'frame', key: el.getAttribute('data-balise-f') || 'frame' };
  const props = ['outline-style','outline-width','outline-color','box-shadow','border-top-color','border-bottom-color','border-bottom-width','background-color','color','text-decoration-line','text-decoration-thickness','transform'];
  const s = getComputedStyle(el);
  const now = focusLook(el, props);
  const before = el.getAttribute('data-balise-fs');
  const transition = s.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
  const r = el.getBoundingClientRect();
  // Independent of the viewport: smooth scrolling may not have brought it in yet.
  const x = r.left + scrollX, y = r.top + scrollY;
  const docW = Math.max(document.documentElement.scrollWidth, innerWidth);
  const clipped = /rect\\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\\)/.test(s.clip) || /inset\\(50%\\)/.test(s.clipPath);
  // Opacity 0 is not invisible: transparent inputs laid over a visible control are a common pattern.
  const visible = r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && !clipped &&
    x + r.width > 0 && y + r.height > 0 && x < docW;
  const modal = !!el.closest('[aria-modal="true"], dialog[open], [role="dialog"], [role="alertdialog"]');
  return { kind: 'el', key: el.getAttribute('data-balise-f') || describe(el).selector, node: describe(el),
    unchanged: before !== null && before === now, transition, visible, modal };
}`;

/** Visible elements (top-level boxes) not marked as visible before. */
const VISIBLE_DIFF = `function (describe, arg) {
  const mark = arg.mark, record = arg.record, exclude = arg.exclude;
  const ex = exclude ? document.querySelector('[data-balise-h="' + exclude + '"]') : null;
  const out = [];
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const vis = r.width >= 8 && r.height >= 8 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.1;
    if (record) { if (vis) el.setAttribute(mark, '1'); else el.removeAttribute(mark); continue; }
    if (!vis || el.getAttribute(mark) === '1') continue;
    if (ex && (ex.contains(el) || el.contains(ex))) continue;
    if (el.parentElement && el.parentElement.closest('[data-balise-new]')) continue;
    if (!(el.textContent || '').trim()) continue;
    el.setAttribute('data-balise-new', '1');
    out.push({ node: describe(el), x: r.left + r.width / 2, y: r.top + r.height / 2 });
    if (out.length >= 5) break;
  }
  for (const n of Array.from(document.querySelectorAll('[data-balise-new]'))) n.removeAttribute('data-balise-new');
  return out;
}`;

const ORIENTATION = `function () {
  const t = (document.body && document.body.innerText) || '';
  const rotated = [document.documentElement, document.body].some((el) => el && /matrix|rotate/.test(getComputedStyle(el).transform) && getComputedStyle(el).transform !== 'none');
  const message = Array.from(document.querySelectorAll('body *')).some((el) => {
    const r = el.getBoundingClientRect();
    if (r.width * r.height < innerWidth * innerHeight * 0.5) return false;
    return /(tourn(ez|er)|pivot(ez|er)|faites pivoter|rotate your|turn your).{0,40}(appareil|écran|device|phone|téléphone|tablette)/i.test(el.textContent || '');
  });
  return { rotated, message, textLength: t.length };
}`;

// ------------------------------------------------------------- the tests

export interface InteractionOptions {
  /** Global budget of all interaction tests, ms. */
  budgetMs?: number;
  /** Idle observation after load (refresh, popups, moving content), ms. */
  idleMs?: number;
  now?: () => number;
}

export async function runInteractions(
  page: Page,
  observation: PageObservation,
  options: InteractionOptions = {},
): Promise<NormalizedRuleResult[]> {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? 45_000);
  const results = new Map<InteractionRule, NormalizedRuleResult>();
  const set = (r: NormalizedRuleResult): void => void results.set(r.rule as InteractionRule, r);
  const guard = async (rules: InteractionRule[], fn: () => Promise<void>): Promise<void> => {
    if (now() > deadline) return;
    try {
      await fn();
    } catch {
      for (const rule of rules) if (!results.has(rule)) set(result(rule, 'incomplete'));
    }
  };
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };

  // 13.1, 13.2, 13.8: observe the page left alone.
  await guard(['balise-new-window', 'balise-auto-refresh', 'balise-moving-content'], async () => {
    observation.markLoaded();
    await page.waitForTimeout(options.idleMs ?? 3000);
    set(
      observation.popups.length
        ? result(
            'balise-new-window',
            'fail',
            observation.popups.map((u) => ({ selector: 'window.open()', html: u.slice(0, 500) })),
          )
        : result('balise-new-window', 'pass'),
    );
    set(
      observation.navigationsAfterLoad.length
        ? result(
            'balise-auto-refresh',
            'fail',
            observation.navigationsAfterLoad.map((u) => ({
              selector: 'location',
              html: `Rechargement ou redirection automatique vers ${u}`.slice(0, 500),
            })),
          )
        : result('balise-auto-refresh', 'pass'),
    );
    const m = await inPage<{ moving: unknown; control: unknown }>(page, MOVING);
    const moving = clampNodes(m.moving);
    set(
      moving.length && m.control !== true
        ? result('balise-moving-content', 'fail', moving)
        : result('balise-moving-content', 'pass'),
    );
  });

  // 12.8, 12.9, 10.7: keyboard walk with Tab.
  await guard(['balise-keyboard-trap', 'balise-tab-order', 'balise-focus-visible'], async () => {
    const count = await inPage<number>(page, FOCUS_SNAPSHOT);
    if (!count) {
      for (const r of ['balise-keyboard-trap', 'balise-tab-order', 'balise-focus-visible'] as const)
        set(result(r, 'inapplicable'));
      return;
    }
    await page.evaluate(
      'document.activeElement && document.activeElement.blur && document.activeElement.blur()',
    );
    const limit = Math.min(count + 10, 250);
    const keys: string[] = [];
    const invisible: FindingNode[] = [];
    const noFocusStyle: FindingNode[] = [];
    let tested = 0;
    let wrapped = false;
    let inModal = false;
    for (let i = 0; i < limit && now() < deadline; i += 1) {
      await page.keyboard.press('Tab');
      const s = await inPage<{
        kind: string;
        key?: string;
        node?: FindingNode;
        unchanged?: boolean;
        transition?: boolean;
        visible?: boolean;
        modal?: boolean;
      }>(page, FOCUS_STATE);
      if (s.kind === 'none') {
        if (keys.length) {
          wrapped = true;
          break;
        }
        continue;
      }
      keys.push(String(s.key));
      if (s.kind !== 'el' || !s.node) continue;
      inModal ||= s.modal === true;
      if (!s.visible) invisible.push(s.node);
      else if (!s.transition) {
        tested += 1;
        if (s.unchanged && !(await focusChangesPixels(page))) noFocusStyle.push(s.node);
      }
    }
    const unique = new Set(keys);
    // A trap: Tab never leaves the page and keeps cycling in a few elements.
    const tail = keys.slice(-20);
    const trapped =
      !wrapped && keys.length >= limit - 1 && new Set(tail).size <= 3 && unique.size < count;
    if (trapped && inModal) set(result('balise-keyboard-trap', 'incomplete'));
    else if (trapped) {
      const last = await inPage<FindingNode | null>(
        page,
        'function (describe) { return document.activeElement ? describe(document.activeElement) : null; }',
      );
      set(result('balise-keyboard-trap', 'fail', last ? [last] : []));
    } else
      set(result('balise-keyboard-trap', wrapped || unique.size >= count ? 'pass' : 'incomplete'));
    set(
      invisible.length
        ? result('balise-tab-order', 'fail', dedupe(invisible))
        : result('balise-tab-order', 'pass'),
    );
    set(
      noFocusStyle.length
        ? result('balise-focus-visible', 'fail', dedupe(noFocusStyle))
        : result('balise-focus-visible', tested ? 'pass' : 'incomplete'),
    );
  });

  // 10.13: additional content on hover must be dismissable and hoverable.
  await guard(['balise-hover-content'], async () => {
    await page.mouse.move(0, 0);
    const handles = await page.$$(
      'nav a[href], nav button, [aria-haspopup], [aria-describedby], [data-tooltip], [data-toggle="tooltip"], [data-bs-toggle="tooltip"], button[aria-expanded]',
    );
    const candidates = handles.slice(0, 12);
    const bad: FindingNode[] = [];
    let triggered = 0;
    for (const [i, h] of candidates.entries()) {
      if (now() > deadline - 3000) break;
      const box = await h.boundingBox();
      if (!box || box.width < 2 || box.y < 0 || box.y > viewport.height) continue;
      await h.evaluate((el, n) => el.setAttribute('data-balise-h', String(n)), i);
      await inPage(page, VISIBLE_DIFF, { mark: 'data-balise-v', record: true });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
      const added = await inPage<Array<{ node: FindingNode; x: number; y: number }>>(
        page,
        VISIBLE_DIFF,
        { mark: 'data-balise-v', record: false, exclude: String(i) },
      );
      if (!added.length) continue;
      triggered += 1;
      const target = await inPage<FindingNode>(
        page,
        "function (describe, i) { return describe(document.querySelector('[data-balise-h=\"' + i + '\"]')); }",
        i,
      );
      // Dismissable: Escape hides it without moving the pointer.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const afterEsc = await inPage<unknown[]>(page, VISIBLE_DIFF, {
        mark: 'data-balise-v',
        record: false,
        exclude: String(i),
      });
      const dismissable = afterEsc.length < added.length;
      // Hoverable: the pointer can move onto it without it disappearing.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(150);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
      const first = added[0]!;
      await page.mouse.move(first.x, first.y, { steps: 5 });
      await page.waitForTimeout(250);
      const still = await inPage<unknown[]>(page, VISIBLE_DIFF, {
        mark: 'data-balise-v',
        record: false,
        exclude: String(i),
      });
      if (!dismissable || still.length === 0)
        bad.push({ selector: target.selector, html: target.html });
      await page.mouse.move(0, 0);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
    set(
      bad.length
        ? result('balise-hover-content', 'fail', bad)
        : result('balise-hover-content', triggered ? 'pass' : 'inapplicable'),
    );
  });

  // 10.12: text spacing (WCAG 1.4.12 values) without cut text.
  await guard(['balise-text-spacing'], async () => {
    await inPage(page, CLIPPED_TEXT, { mark: 'data-balise-c0', baseline: null, edge: false });
    await applySheet(
      page,
      'balise-spacing',
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
    );
    await page.waitForTimeout(200);
    const cut = clampNodes(
      await inPage(page, CLIPPED_TEXT, {
        mark: 'data-balise-c1',
        baseline: 'data-balise-c0',
        edge: false,
      }),
    );
    await removeSheet(page, 'balise-spacing');
    set(
      cut.length
        ? result('balise-text-spacing', 'fail', cut)
        : result('balise-text-spacing', 'pass'),
    );
  });

  // 10.4: text at 200 % (text-only zoom, then a 640 px wide viewport = 200 % zoom).
  await guard(['balise-text-zoom'], async () => {
    await applySheet(page, 'balise-zoom', 'html { font-size: 200% !important; }');
    await page.waitForTimeout(200);
    const textOnly = clampNodes(
      await inPage(page, CLIPPED_TEXT, {
        mark: 'data-balise-c2',
        baseline: 'data-balise-c0',
        edge: false,
      }),
    );
    await removeSheet(page, 'balise-zoom');
    await page.setViewportSize({
      width: Math.round(viewport.width / 2),
      height: Math.round(viewport.height / 2),
    });
    await page.waitForTimeout(400);
    const zoomed = clampNodes(
      await inPage(page, CLIPPED_TEXT, {
        mark: 'data-balise-c3',
        baseline: 'data-balise-c0',
        edge: false,
      }),
    );
    const cut = dedupe([...textOnly, ...zoomed]);
    set(cut.length ? result('balise-text-zoom', 'fail', cut) : result('balise-text-zoom', 'pass'));
  });

  // 10.11: 320 CSS px wide, no content cut on the right / horizontal scrolling.
  await guard(['balise-reflow'], async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(400);
    const cut = clampNodes(
      await inPage(page, CLIPPED_TEXT, { mark: 'data-balise-c4', baseline: null, edge: true }),
    );
    set(cut.length ? result('balise-reflow', 'fail', cut) : result('balise-reflow', 'pass'));
  });

  // 13.9: portrait and landscape.
  await guard(['balise-orientation'], async () => {
    const states: Array<{ rotated: boolean; message: boolean }> = [];
    for (const size of [
      { width: 412, height: 915 },
      { width: 915, height: 412 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(300);
      states.push(await inPage(page, ORIENTATION));
    }
    const locked = states.some((s) => s.message) || states[0]!.rotated !== states[1]!.rotated;
    set(
      locked
        ? result('balise-orientation', 'fail', [
            { selector: 'body', html: 'Contenu bloqué ou retourné dans une orientation' },
          ])
        : result('balise-orientation', 'pass'),
    );
  });

  await page.setViewportSize(viewport).catch(() => undefined);
  observation.dispose();
  return INTERACTION_RULES.map((rule) => results.get(rule) ?? result(rule, 'incomplete'));
}

/**
 * Confirms a "no style change" verdict with pixels: the element area (with a
 * margin for outlines and shadows) focused, then blurred. Any difference
 * (pseudo-element, ancestor, caret…) counts as a visible focus. Chromium keeps
 * the sequential focus starting point after blur(), so the walk goes on.
 */
async function focusChangesPixels(page: Page): Promise<boolean> {
  const box = (await page.evaluate(`(() => {
    const el = document.activeElement;
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  })()`)) as { x: number; y: number; width: number; height: number } | null;
  if (!box || box.width < 1 || box.height < 1) return true;
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  const x = Math.max(0, box.x - 8);
  const y = Math.max(0, box.y - 8);
  const clip = {
    x,
    y,
    width: Math.max(1, Math.min(vp.width - x, box.width + 16)),
    height: Math.max(1, Math.min(vp.height - y, box.height + 16)),
  };
  const focused = await page.screenshot({ clip, animations: 'disabled', caret: 'initial' });
  await page.evaluate('document.activeElement && document.activeElement.blur()');
  const blurred = await page.screenshot({ clip, animations: 'disabled', caret: 'initial' });
  return !focused.equals(blurred);
}

function dedupe(nodes: FindingNode[]): FindingNode[] {
  const seen = new Set<string>();
  return nodes.filter((n) => !seen.has(n.selector) && seen.add(n.selector));
}

/** Uses a constructed stylesheet: allowed by strict page CSPs, unlike <style>. */
async function applySheet(page: Page, id: string, css: string): Promise<void> {
  await page.evaluate(
    ({ id: key, css: text }) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      (window as unknown as Record<string, CSSStyleSheet>)[`__${key}`] = sheet;
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    },
    { id, css },
  );
}

async function removeSheet(page: Page, id: string): Promise<void> {
  await page.evaluate((key) => {
    const sheet = (window as unknown as Record<string, CSSStyleSheet>)[`__${key}`];
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  }, id);
}
