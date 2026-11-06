import { describe, expect, it } from 'vitest';
import { validateUrl } from './url';

describe('validateUrl', () => {
  it.each([
    ['https://www.exemple.fr/contact', 'https://www.exemple.fr/contact'],
    ['www.exemple.fr', 'https://www.exemple.fr/'],
    ['  http://exemple.fr  ', 'http://exemple.fr/'],
    ['exemple.fr:8080/page', 'https://exemple.fr:8080/page'],
  ])('accepts %s', (input, url) => {
    expect(validateUrl(input)).toEqual({ ok: true, url });
  });

  it.each([
    ['', 'empty'],
    ['ftp://exemple.fr', 'scheme'],
    ['javascript:alert(1)', 'scheme'],
    ['https://exem ple.fr', 'invalid'],
    ['https://user:pass@exemple.fr', 'credentials'],
    ['http://localhost:3000', 'private'],
    ['http://192.168.1.10', 'private'],
    ['http://169.254.169.254/latest', 'private'],
    ['http://[::1]/', 'private'],
    ['https://intranet', 'host'],
  ])('rejects %s (%s)', (input, problem) => {
    expect(validateUrl(input)).toEqual({ ok: false, problem });
  });
});
