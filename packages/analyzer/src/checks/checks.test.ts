// @vitest-environment jsdom
/// <reference lib="dom" />
import { describe, expect, it } from 'vitest';
import {
  BALISE_CHECKS,
  checkExpression,
  checkHeadingHierarchy,
  checkPageLang,
  checkPageTitle,
  checkSkipLink,
  describeElement,
  runCheckOnDocument,
  sanitizeCheckResult,
} from './index.js';

function load(body: string, head = '<title>Test</title>', htmlAttrs = 'lang="fr"'): Document {
  document.documentElement.innerHTML = `<head>${head}</head><body>${body}</body>`;
  for (const { name } of Array.from(document.documentElement.attributes))
    document.documentElement.removeAttribute(name);
  const attrs = new DOMParser().parseFromString(`<html ${htmlAttrs}></html>`, 'text/html')
    .documentElement.attributes;
  for (const { name, value } of Array.from(attrs))
    document.documentElement.setAttribute(name, value);
  return document;
}

describe('describeElement', () => {
  it('builds a unique selector, preferring ids, and truncates the HTML', () => {
    const doc = load(
      `<main id="m"><p>a</p><p>b<span>${'x'.repeat(600)}</span></p></main><div><p>c</p></div>`,
    );
    const span = doc.querySelector('span')!;
    const node = describeElement(span);
    expect(node.selector).toBe('#m > p:nth-of-type(2) > span');
    expect(doc.querySelectorAll(node.selector)).toHaveLength(1);
    expect(node.html.endsWith('…')).toBe(true);
    expect(describeElement(doc.querySelector('div p')!).selector).toBe('html > body > div > p');
  });

  it('escapes ids starting with a digit and ignores duplicated ids', () => {
    const doc = load('<p id="1a">x</p><b id="d">1</b><b id="d">2</b>');
    const sel = describeElement(doc.querySelector('p')!).selector;
    expect(doc.querySelector(sel)?.textContent).toBe('x');
    expect(describeElement(doc.querySelectorAll('b')[1]!).selector).toBe(
      'html > body > b:nth-of-type(2)',
    );
  });
});

describe('checkSkipLink', () => {
  const run = (body: string) => runCheckOnDocument(checkSkipLink, load(body));
  it('passes with an early in-page link to an existing target (id or name)', () => {
    expect(run('<a href="#main">Aller</a><main id="main"></main>').outcome).toBe('pass');
    expect(run('<a href="#c%C3%A9">Aller</a><main id="cé"></main>').outcome).toBe('pass');
    expect(run('<a href="#n">Aller</a><a name="n"></a>').outcome).toBe('pass');
  });
  it('fails on a broken skip link or none among the first focusable elements', () => {
    expect(run('<a href="#absent">Aller</a><a href="/x">x</a>')).toMatchObject({
      outcome: 'fail',
      nodes: [{ html: '<a href="#absent">Aller</a>' }],
    });
    const late = run(
      '<a href="/1">1</a><a href="/2">2</a><a href="/3">3</a><a href="/4">4</a><a href="/5">5</a><a href="#m">m</a><main id="m"></main>',
    );
    expect(late.outcome).toBe('fail');
    expect(late.nodes[0]!.html).toBe('<body>');
    expect(run('<a href="#%E0%A4%A">bad</a>').outcome).toBe('fail');
  });
  it('ignores hidden inputs, disabled and negative tabindex; inapplicable without focusable', () => {
    expect(
      run('<p>texte</p><input type="hidden"><button disabled>x</button><div tabindex="-1"></div>')
        .outcome,
    ).toBe('inapplicable');
    expect(run('<input type="text"><a href="#">top</a>').outcome).toBe('fail');
  });
});

describe('checkHeadingHierarchy', () => {
  const run = (body: string) => runCheckOnDocument(checkHeadingHierarchy, load(body));
  it('passes on a consistent hierarchy, including ARIA headings', () => {
    expect(
      run('<h1>a</h1><h2>b</h2><div role="heading" aria-level="3">c</div><h2>d</h2>').outcome,
    ).toBe('pass');
    expect(run('<h1>a</h1><div role="heading">x</div><h3>y</h3>').outcome).toBe('pass');
    expect(run('<h2>a</h2><h3>b</h3>').outcome).toBe('fail');
  });
  it('fails on a skipped level', () => {
    const r = run('<h1>a</h1><h3>b</h3><h4 role="heading" aria-level="5">c</h4>');
    expect(r.outcome).toBe('fail');
    expect(r.nodes.map((n) => n.html)).toEqual([
      '<h3>b</h3>',
      '<h4 role="heading" aria-level="5">c</h4>',
    ]);
    expect(run('<h3>a</h3>').outcome).toBe('fail');
  });
  it('ignores hidden headings and is incomplete without headings', () => {
    expect(
      run(
        '<h1>a</h1><h3 hidden>b</h3><div aria-hidden="true"><h4>c</h4></div><h4 style="display:none">d</h4><h2>e</h2>',
      ).outcome,
    ).toBe('pass');
    expect(
      run('<p>rien</p><h2 role="heading" aria-level="0" style="visibility:hidden">x</h2>').outcome,
    ).toBe('incomplete');
  });
});

describe('checkPageLang', () => {
  const run = (attrs: string) =>
    runCheckOnDocument(checkPageLang, load('<p>x</p>', '<title>t</title>', attrs));
  it('validates the language code of <html>', () => {
    expect(run('lang="fr"')).toMatchObject({
      outcome: 'pass',
      nodes: [{ selector: 'html', html: '<html lang="fr">' }],
    });
    expect(run('lang="fr-FR"').outcome).toBe('pass');
    expect(run('xml:lang="en"').outcome).toBe('pass');
    expect(run('').outcome).toBe('fail');
    expect(run('lang=" "').outcome).toBe('fail');
    expect(run('lang="français"').outcome).toBe('fail');
  });
});

describe('checkPageTitle', () => {
  const run = (head: string) => runCheckOnDocument(checkPageTitle, load('<p>x</p>', head));
  it('requires a non-empty title', () => {
    expect(run('<title>Accueil</title>').outcome).toBe('pass');
    expect(run('<title> \n </title>')).toMatchObject({
      outcome: 'fail',
      nodes: [{ selector: 'html > head > title' }],
    });
    expect(run('')).toMatchObject({ outcome: 'fail', nodes: [{ selector: 'html' }] });
  });
});

describe('check plumbing', () => {
  it('serialises every check as a self-contained expression', () => {
    load('<a href="#m">m</a><main id="m"><h1>t</h1></main>');
    for (const { rule, fn } of BALISE_CHECKS) {
      // Indirect eval: same as page.evaluate, without closure access.
      const result = (0, eval)(checkExpression(fn)) as { rule: string; outcome: string };
      expect(result.rule).toBe(rule);
      expect(result.outcome).toBe('pass');
    }
  });

  it('sanitises untrusted results from the page', () => {
    expect(sanitizeCheckResult('r', null)).toEqual({ rule: 'r', outcome: 'incomplete', nodes: [] });
    expect(sanitizeCheckResult('r', { outcome: 'weird' }).outcome).toBe('incomplete');
    expect(sanitizeCheckResult('r', { outcome: 'pass' })).toEqual({
      rule: 'r',
      outcome: 'pass',
      nodes: [],
    });
    const long = 'x'.repeat(2000);
    expect(
      sanitizeCheckResult('r', {
        rule: 'spoofed',
        outcome: 'fail',
        nodes: [null, { selector: 1, html: 'a' }, { selector: long, html: long }],
      }),
    ).toEqual({
      rule: 'r',
      outcome: 'fail',
      nodes: [{ selector: 'x'.repeat(1000), html: 'x'.repeat(1000) }],
    });
  });
});
