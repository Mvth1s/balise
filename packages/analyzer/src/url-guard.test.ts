import { describe, expect, it, vi } from 'vitest';
import { AnalysisError } from './errors.js';
import {
  isForbiddenHostName,
  isPublicAddress,
  normalizeHost,
  parseAndValidateUrl,
  resolveAndCheck,
  validateTarget,
  type LookupAll,
} from './url-guard.js';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as AnalysisError).code;
  }
  return undefined;
}

async function asyncCodeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return (e as AnalysisError).code;
  }
  return undefined;
}

const lookupTo =
  (...addresses: string[]): LookupAll =>
  async () =>
    addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }) as const);

describe('parseAndValidateUrl', () => {
  it('accepts http and https URLs and strips the fragment', () => {
    expect(parseAndValidateUrl('https://exemple.fr/page?q=1#ancre').href).toBe(
      'https://exemple.fr/page?q=1',
    );
    expect(parseAndValidateUrl('  http://exemple.fr  ').href).toBe('http://exemple.fr/');
  });

  it('accepts explicit ports 80 and 443 only', () => {
    expect(parseAndValidateUrl('http://exemple.fr:80/').port).toBe('');
    expect(parseAndValidateUrl('https://exemple.fr:443/').port).toBe('');
    expect(parseAndValidateUrl('https://exemple.fr:80/').port).toBe('80');
    expect(parseAndValidateUrl('http://exemple.fr:443/').port).toBe('443');
    for (const port of ['8080', '22', '6379', '3000', '0', '65535']) {
      expect(codeOf(() => parseAndValidateUrl(`http://exemple.fr:${port}/`))).toBe(
        'forbidden_target',
      );
    }
  });

  it('allows any port with allowPrivateHosts (tests only)', () => {
    expect(parseAndValidateUrl('http://127.0.0.1:3000/', { allowPrivateHosts: true }).port).toBe(
      '3000',
    );
  });

  it('refuses other schemes', () => {
    for (const u of [
      'ftp://exemple.fr/',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<p>x</p>',
      'gopher://exemple.fr/',
      'ws://exemple.fr/',
      'chrome://settings',
      'blob:https://exemple.fr/x',
    ]) {
      expect(
        codeOf(() => parseAndValidateUrl(u)),
        u,
      ).toBe('forbidden_target');
    }
  });

  it('refuses credentials', () => {
    expect(codeOf(() => parseAndValidateUrl('https://user@exemple.fr/'))).toBe('forbidden_target');
    expect(codeOf(() => parseAndValidateUrl('https://user:pass@exemple.fr/'))).toBe(
      'forbidden_target',
    );
    expect(codeOf(() => parseAndValidateUrl('https://:pass@exemple.fr/'))).toBe('forbidden_target');
  });

  it('refuses empty, unparseable and too long input', () => {
    expect(codeOf(() => parseAndValidateUrl(''))).toBe('invalid_url');
    expect(codeOf(() => parseAndValidateUrl('   '))).toBe('invalid_url');
    expect(codeOf(() => parseAndValidateUrl('exemple.fr'))).toBe('invalid_url');
    expect(codeOf(() => parseAndValidateUrl('http://'))).toBe('invalid_url');
    expect(codeOf(() => parseAndValidateUrl('https://exemple .fr'))).toBe('invalid_url');
    expect(codeOf(() => parseAndValidateUrl(42 as unknown as string))).toBe('invalid_url');
    expect(codeOf(() => parseAndValidateUrl(`https://exemple.fr/${'a'.repeat(2048)}`))).toBe(
      'invalid_url',
    );
    // Under the limit as typed but over it once percent-encoded.
    expect(codeOf(() => parseAndValidateUrl(`https://exemple.fr/${'é'.repeat(1000)}`))).toBe(
      'invalid_url',
    );
  });

  it('converts IDN to punycode', () => {
    expect(parseAndValidateUrl('https://exémple.fr/').hostname).toBe('xn--exmple-cva.fr');
  });

  it('normalises exotic IPv4 notations (WHATWG parser)', () => {
    expect(parseAndValidateUrl('http://2130706433/').hostname).toBe('127.0.0.1');
    expect(parseAndValidateUrl('http://0x7f000001/').hostname).toBe('127.0.0.1');
    expect(parseAndValidateUrl('http://0177.0.0.1/').hostname).toBe('127.0.0.1');
    expect(parseAndValidateUrl('http://0x7f.1/').hostname).toBe('127.0.0.1');
    expect(parseAndValidateUrl('http://127.1/').hostname).toBe('127.0.0.1');
    expect(parseAndValidateUrl('http://017700000001/').hostname).toBe('127.0.0.1');
    expect(parseAndValidateUrl('http://169.254.169.254/').hostname).toBe('169.254.169.254');
    expect(parseAndValidateUrl('http://0xa9fea9fe/').hostname).toBe('169.254.169.254');
    expect(parseAndValidateUrl('http://[::ffff:127.0.0.1]/').hostname).toBe('[::ffff:7f00:1]');
    expect(parseAndValidateUrl('http://①②⑦.0.0.1/').hostname).toBe('127.0.0.1');
  });
});

describe('isPublicAddress', () => {
  it('accepts public unicast addresses', () => {
    for (const ip of [
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
      '2606:4700:4700::1111',
      '2001:4860:4860::8888',
      '2a00:1450::1',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
    expect(isPublicAddress('[2606:4700:4700::1111]')).toBe(true);
  });

  it('refuses private, reserved and special IPv4 ranges', () => {
    for (const ip of [
      '0.0.0.0',
      '0.1.2.3',
      '10.0.0.1',
      '10.255.255.255',
      '100.64.0.1',
      '100.127.255.254',
      '127.0.0.1',
      '127.255.255.254',
      '169.254.169.254',
      '169.254.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.0.0.8',
      '192.0.2.1',
      '192.88.99.1',
      '192.168.1.1',
      '198.18.0.1',
      '198.19.255.255',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '239.255.255.250',
      '240.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it('accepts addresses just outside private ranges', () => {
    for (const ip of [
      '172.15.255.255',
      '172.32.0.1',
      '100.63.255.255',
      '100.128.0.1',
      '11.0.0.1',
      '198.20.0.1',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it('refuses special IPv6 ranges', () => {
    for (const ip of [
      '::',
      '::1',
      'fe80::1',
      'febf::1',
      'fec0::1',
      'fc00::1',
      'fd12:3456::1',
      'ff02::1',
      'ff05::2',
      '100::1',
      '2001:db8::1',
      '2001::1',
      '2001:0:4136:e378:8000:63bf:3fff:fdd2',
      '2002:c0a8:101::1',
      '2002:808:808::1',
      '3fff::1',
      '5f00::1',
      '2001:2::1',
      '2001:10::1',
      '2001:20::1',
      '::ffff:0:7f00:1',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it('judges IPv4-mapped, IPv4-compatible and NAT64 addresses by the embedded IPv4', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false);
    expect(isPublicAddress('::ffff:169.254.169.254')).toBe(false);
    expect(isPublicAddress('::ffff:10.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
    expect(isPublicAddress('::127.0.0.1')).toBe(false);
    expect(isPublicAddress('::10.0.0.1')).toBe(false);
    expect(isPublicAddress('::8.8.8.8')).toBe(true);
    expect(isPublicAddress('64:ff9b::127.0.0.1')).toBe(false);
    expect(isPublicAddress('64:ff9b::a9fe:a9fe')).toBe(false);
    expect(isPublicAddress('64:ff9b::8.8.8.8')).toBe(true);
    expect(isPublicAddress('64:ff9b:1::10.0.0.1')).toBe(false);
    expect(isPublicAddress('64:ff9b:1::c0a8:101')).toBe(false);
    expect(isPublicAddress('64:ff9b:1::8.8.8.8')).toBe(true);
  });

  it('refuses invalid strings and zone ids', () => {
    for (const v of [
      '',
      'exemple.fr',
      '256.0.0.1',
      '1.2.3',
      'fe80::1%eth0',
      '2001:4860::1%1',
      '0x7f000001',
      '2130706433',
    ]) {
      expect(isPublicAddress(v), v).toBe(false);
    }
  });
});

describe('host names', () => {
  it('normalises', () => {
    expect(normalizeHost(' ExEmple.FR.. ')).toBe('exemple.fr');
    expect(normalizeHost('[::1]')).toBe('::1');
  });

  it('flags local and internal names', () => {
    for (const h of [
      'localhost',
      'LOCALHOST',
      'localhost.',
      'api.localhost',
      'metadata.google.internal',
      'metadata',
      'foo.internal',
      'printer.local',
      'router.home.arpa',
    ]) {
      expect(isForbiddenHostName(h), h).toBe(true);
    }
    expect(isForbiddenHostName('internal.exemple.fr')).toBe(false);
    expect(isForbiddenHostName('localhost.exemple.fr')).toBe(false);
  });
});

describe('resolveAndCheck', () => {
  it('returns the addresses when all are public', async () => {
    await expect(
      resolveAndCheck('exemple.fr', lookupTo('93.184.216.34', '2606:2800:220:1::1')),
    ).resolves.toEqual([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1::1', family: 6 },
    ]);
  });

  it('refuses if a single address is not public', async () => {
    expect(
      await asyncCodeOf(resolveAndCheck('exemple.fr', lookupTo('93.184.216.34', '10.0.0.1'))),
    ).toBe('forbidden_target');
    expect(await asyncCodeOf(resolveAndCheck('exemple.fr', lookupTo('2606:2800::1', '::1')))).toBe(
      'forbidden_target',
    );
    expect(
      await asyncCodeOf(resolveAndCheck('exemple.fr', lookupTo('::ffff:169.254.169.254'))),
    ).toBe('forbidden_target');
  });

  it('refuses forbidden names without resolving them', async () => {
    const lookup = vi.fn(lookupTo('93.184.216.34'));
    for (const h of ['localhost', 'a.localhost', 'metadata.google.internal', 'x.internal']) {
      expect(await asyncCodeOf(resolveAndCheck(h, lookup))).toBe('forbidden_target');
    }
    expect(lookup).not.toHaveBeenCalled();
  });

  it('checks IP literals without DNS', async () => {
    const lookup = vi.fn(lookupTo('93.184.216.34'));
    expect(await asyncCodeOf(resolveAndCheck('127.0.0.1', lookup))).toBe('forbidden_target');
    expect(await asyncCodeOf(resolveAndCheck('[::1]', lookup))).toBe('forbidden_target');
    expect(await asyncCodeOf(resolveAndCheck('[::ffff:7f00:1]', lookup))).toBe('forbidden_target');
    await expect(resolveAndCheck('8.8.8.8', lookup)).resolves.toEqual([
      { address: '8.8.8.8', family: 4 },
    ]);
    await expect(resolveAndCheck('[2606:4700::1111]', lookup)).resolves.toEqual([
      { address: '2606:4700::1111', family: 6 },
    ]);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('maps DNS errors and empty answers to dns_failure', async () => {
    const failing: LookupAll = async () => {
      throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    };
    expect(await asyncCodeOf(resolveAndCheck('nexiste-pas.exemple', failing))).toBe('dns_failure');
    expect(await asyncCodeOf(resolveAndCheck('vide.exemple', lookupTo()))).toBe('dns_failure');
    expect(await asyncCodeOf(resolveAndCheck('', lookupTo()))).toBe('invalid_url');
  });

  it('skips address checks with allowPrivateHosts', async () => {
    await expect(
      resolveAndCheck('localhost', lookupTo('127.0.0.1'), { allowPrivateHosts: true }),
    ).resolves.toEqual([{ address: '127.0.0.1', family: 4 }]);
    await expect(
      resolveAndCheck('127.0.0.1', lookupTo(), { allowPrivateHosts: true }),
    ).resolves.toHaveLength(1);
  });

  it('uses the system resolver by default', async () => {
    await expect(resolveAndCheck('localhost')).rejects.toBeInstanceOf(AnalysisError);
  });
});

describe('validateTarget', () => {
  it('chains URL parsing and resolution', async () => {
    const { url, addresses } = await validateTarget(
      'https://exemple.fr/',
      lookupTo('93.184.216.34'),
    );
    expect(url.hostname).toBe('exemple.fr');
    expect(addresses).toHaveLength(1);
  });

  it('refuses exotic loopback notations after normalisation', async () => {
    for (const u of [
      'http://2130706433/',
      'http://0x7f000001/',
      'http://0177.0.0.1/',
      'http://127.1/',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[0:0:0:0:0:ffff:7f00:1]/',
      'http://0/',
      'http://0.0.0.0/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[fd00:ec2::254]/',
      'http://100.100.100.200/',
      'http://localhost./',
      'http://LocalHost/',
    ]) {
      expect(await asyncCodeOf(validateTarget(u, lookupTo('93.184.216.34'))), u).toBe(
        'forbidden_target',
      );
    }
  });
});
