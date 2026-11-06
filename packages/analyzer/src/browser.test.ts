import { describe, expect, it } from 'vitest';
import {
  BALISE_DISABLED_FEATURES,
  buildLaunchArgs,
  FORBIDDEN_ARGS,
  PLAYWRIGHT_DISABLED_FEATURES,
} from './browser.js';

// Arguments of @sparticuz/chromium 153 with setGraphicsMode = false.
const SPARTICUZ = [
  '--no-pings',
  '--single-process',
  '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
  '--enable-features=SharedArrayBuffer',
  '--disable-webgl',
  '--allow-running-insecure-content',
  '--disable-site-isolation-trials',
  '--disable-web-security',
  '--no-sandbox',
];

describe('buildLaunchArgs', () => {
  it('drops the flags that weaken the browser and merges --disable-features once', () => {
    const args = buildLaunchArgs(SPARTICUZ);
    for (const forbidden of FORBIDDEN_ARGS) expect(args).not.toContain(forbidden);
    const disable = args.filter((a) => a.startsWith('--disable-features='));
    expect(disable).toHaveLength(1);
    expect(args.at(-1)).toBe(disable[0]);
    const features = disable[0]!.slice('--disable-features='.length).split(',');
    for (const f of [
      ...PLAYWRIGHT_DISABLED_FEATURES,
      ...BALISE_DISABLED_FEATURES,
      'AudioServiceOutOfProcess',
    ])
      expect(features).toContain(f);
    expect(new Set(features).size).toBe(features.length);
    expect(args).toEqual(
      expect.arrayContaining([
        '--single-process',
        '--disable-webgl',
        '--disable-quic',
        '--js-flags=--jitless',
        '--proxy-server=http://127.0.0.1:9',
        '--proxy-bypass-list=<-loopback>',
      ]),
    );
    expect(args.filter((a) => a === '--no-pings')).toHaveLength(1);
  });

  it('works without platform arguments (local Chromium)', () => {
    const args = buildLaunchArgs();
    expect(args.filter((a) => a.startsWith('--disable-features='))).toHaveLength(1);
    expect(args).toContain('--disable-quic');
  });
});
