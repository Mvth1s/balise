import { describe, expect, it } from 'vitest';
import { isHtmlContentType, redirectTarget } from './navigate.js';

describe('redirectTarget', () => {
  const base = 'https://exemple.fr/a/b';
  it('resolves relative locations and drops the fragment', () => {
    expect(redirectTarget(302, { location: '../c#x' }, base)?.href).toBe('https://exemple.fr/c');
    expect(redirectTarget(301, { location: 'http://autre.fr/' }, base)?.href).toBe(
      'http://autre.fr/',
    );
  });
  it('ignores non-redirect statuses and missing locations', () => {
    expect(redirectTarget(200, { location: '/x' }, base)).toBeNull();
    expect(redirectTarget(304, {}, base)).toBeNull();
    expect(redirectTarget(400, { location: '/x' }, base)).toBeNull();
  });
  it('refuses non-http(s) and invalid targets', () => {
    for (const location of [
      'file:///etc/passwd',
      'data:text/html,x',
      'javascript:alert(1)',
      'ftp://exemple.fr/',
    ]) {
      expect(() => redirectTarget(302, { location }, base)).toThrow(
        expect.objectContaining({ code: 'forbidden_target' }),
      );
    }
    expect(() => redirectTarget(302, { location: 'http://[::1' }, base)).toThrow(
      expect.objectContaining({ code: 'unreachable' }),
    );
  });
});

describe('isHtmlContentType', () => {
  it('accepts HTML and XHTML only', () => {
    expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true);
    expect(isHtmlContentType('Application/XHTML+XML')).toBe(true);
    expect(isHtmlContentType('application/pdf')).toBe(false);
    expect(isHtmlContentType(undefined)).toBe(false);
  });
});
