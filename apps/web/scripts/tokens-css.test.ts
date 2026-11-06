import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateTokensCss, pxToRem, type TokensFile } from './tokens-css';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('tokens.css', () => {
  it('is up to date with docs/charte/tokens.json', () => {
    const tokens = JSON.parse(read('../../../docs/charte/tokens.json')) as TokensFile;
    expect(read('../src/styles/tokens.css')).toBe(generateTokensCss(tokens));
  });

  it('converts px to rem', () => {
    expect(pxToRem('17px')).toBe('1.0625rem');
    expect(pxToRem('1.5em')).toBe('1.5em');
  });
});
