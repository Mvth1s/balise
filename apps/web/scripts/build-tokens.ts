/**
 * Generates apps/web/src/styles/tokens.css from docs/charte/tokens.json.
 *
 *   node --experimental-strip-types apps/web/scripts/build-tokens.ts
 *
 * The generated file is versioned; a Vitest test fails when it is stale.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTokensCss, type TokensFile } from './tokens-css.ts';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../../docs/charte/tokens.json');
const target = resolve(here, '../src/styles/tokens.css');

const tokens = JSON.parse(readFileSync(source, 'utf8')) as TokensFile;
writeFileSync(target, generateTokensCss(tokens), 'utf8');
console.log(`tokens.css generated from ${source}`);
