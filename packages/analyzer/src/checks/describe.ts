/// <reference lib="dom" />
import type { FindingNode } from '../types.js';

/**
 * Builds a CSS selector and a short outer-HTML snippet for an element.
 * Self-contained: serialised and executed inside the analysed page.
 */
export function describeElement(el: Element): FindingNode {
  const esc = (value: string): string =>
    value.replace(/[^a-zA-Z0-9_\u00a0-\uffff-]/g, (c) => `\\${c}`).replace(/^(\d)/, '\\3$1 ');
  const doc = el.ownerDocument;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1) {
    const current: Element = node;
    if (current.id && doc.querySelectorAll(`#${esc(current.id)}`).length === 1) {
      parts.unshift(`#${esc(current.id)}`);
      break;
    }
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const sameTag = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(current) + 1})` : tag);
    node = parent;
  }
  const outer = el.outerHTML;
  const html = outer.length > 500 ? `${outer.slice(0, 500)}…` : outer;
  return { selector: parts.join(' > '), html };
}
