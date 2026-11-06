/**
 * SSRF guard: URL validation, address classification and DNS checks.
 *
 * Every address the analyzer connects to must be a public unicast address.
 * The same checks are applied at submission time (API) and at connection time
 * (safe-fetch custom lookup), see docs/securite.md.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { AnalysisError } from './errors.js';

export const MAX_URL_LENGTH = 2048;
export const ALLOWED_PORTS: readonly string[] = ['', '80', '443'];

export interface GuardOptions {
  /**
   * Disables the address, host name and port checks. Code-level parameter
   * ONLY for tests and `pnpm demo:build` (never read from the environment).
   */
  allowPrivateHosts?: boolean;
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

/** Resolves every A/AAAA record of a host name. */
export type LookupAll = (hostname: string) => Promise<ResolvedAddress[]>;

export const defaultLookup: LookupAll = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, order: 'verbatim' });
  return records.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
};

/**
 * Parses and validates a user-submitted URL.
 * - invalid_url: empty, too long or unparseable;
 * - forbidden_target: scheme other than http/https, credentials, port other than 80/443.
 * Internationalised host names are converted to punycode by the WHATWG parser;
 * decimal/octal/hexadecimal IPv4 forms are normalised to dotted decimal.
 * The fragment is removed.
 */
export function parseAndValidateUrl(input: string, options: GuardOptions = {}): URL {
  if (typeof input !== 'string') throw new AnalysisError('invalid_url');
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    throw new AnalysisError(
      'invalid_url',
      trimmed.length === 0
        ? 'Veuillez saisir une adresse de page web.'
        : `L'adresse dépasse la longueur maximale de ${MAX_URL_LENGTH} caractères.`,
    );
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AnalysisError(
      'invalid_url',
      "L'adresse saisie n'est pas une URL valide (exemple attendu : https://exemple.fr/page).",
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AnalysisError(
      'forbidden_target',
      'Seules les adresses en http ou https sont acceptées.',
    );
  }
  if (url.username !== '' || url.password !== '') {
    throw new AnalysisError(
      'forbidden_target',
      'Les adresses contenant un identifiant ou un mot de passe ne sont pas acceptées.',
    );
  }
  if (url.hostname === '') throw new AnalysisError('invalid_url');
  if (!options.allowPrivateHosts && !ALLOWED_PORTS.includes(url.port)) {
    throw new AnalysisError('forbidden_target', 'Seuls les ports 80 et 443 sont acceptés.');
  }
  url.hash = '';
  if (url.href.length > MAX_URL_LENGTH) {
    throw new AnalysisError(
      'invalid_url',
      `L'adresse dépasse la longueur maximale de ${MAX_URL_LENGTH} caractères.`,
    );
  }
  return url;
}

/** Normalises a URL hostname for checks: lowercase, no brackets, no trailing dot. */
export function normalizeHost(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  while (h.endsWith('.')) h = h.slice(0, -1);
  return h;
}

const FORBIDDEN_HOST_NAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);
const FORBIDDEN_HOST_SUFFIXES = ['.localhost', '.internal', '.local', '.home.arpa', '.localdomain'];

/** True for host names that always designate local or cloud-internal services. */
export function isForbiddenHostName(host: string): boolean {
  const h = normalizeHost(host);
  return FORBIDDEN_HOST_NAMES.has(h) || FORBIDDEN_HOST_SUFFIXES.some((s) => h.endsWith(s));
}

/** Explicit IPv4 deny-list, on top of ipaddr.js range classification. */
const IPV4_DENY: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const IPV4_DENY_PARSED = IPV4_DENY.map(([a, p]) => [ipaddr.IPv4.parse(a), p] as const);

function isPublicIPv4(ip: ipaddr.IPv4): boolean {
  if (ip.range() !== 'unicast') return false;
  return !IPV4_DENY_PARSED.some(([net, prefix]) => ip.match(net, prefix));
}

const GLOBAL_UNICAST_V6 = ipaddr.IPv6.parse('2000::');
const NAT64_WELL_KNOWN = ipaddr.IPv6.parse('64:ff9b::');
const NAT64_LOCAL = ipaddr.IPv6.parse('64:ff9b:1::');
const IPV4_COMPATIBLE = ipaddr.IPv6.parse('::');
const IPV4_TRANSLATED = ipaddr.IPv6.parse('::ffff:0:0:0');

function embeddedIPv4(ip: ipaddr.IPv6): ipaddr.IPv4 {
  const p = ip.parts;
  const hi = p[6] ?? 0;
  const lo = p[7] ?? 0;
  return new ipaddr.IPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
}

function isPublicIPv6(ip: ipaddr.IPv6): boolean {
  // Forms embedding an IPv4 address in the last 32 bits: judge the IPv4.
  if (
    ip.isIPv4MappedAddress() ||
    ip.match(IPV4_TRANSLATED, 96) ||
    ip.match(NAT64_WELL_KNOWN, 96) ||
    ip.match(NAT64_LOCAL, 48)
  ) {
    return isPublicIPv4(embeddedIPv4(ip));
  }
  // IPv4-compatible (deprecated, ::a.b.c.d), including :: and ::1.
  if (ip.match(IPV4_COMPATIBLE, 96)) {
    if (ip.range() === 'unspecified' || ip.range() === 'loopback') return false;
    return isPublicIPv4(embeddedIPv4(ip));
  }
  // Tunnels (6to4, Teredo) can reach arbitrary IPv4 hosts: always refused.
  if (ip.range() !== 'unicast') return false;
  // Only global unicast 2000::/3 is acceptable (excludes ULA, link-local,
  // site-local fec0::/10, multicast, discard, segment routing...).
  return ip.match(GLOBAL_UNICAST_V6, 3);
}

/** True only for public unicast IPv4/IPv6 addresses. Invalid input → false. */
export function isPublicAddress(ip: string): boolean {
  const raw = normalizeHost(ip);
  const withoutZone = raw.includes('%') ? raw.slice(0, raw.indexOf('%')) : raw;
  if (raw !== withoutZone) return false; // zone ids only make sense for link-local
  if (isIP(withoutZone) === 0) return false;
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(withoutZone);
  } catch {
    return false;
  }
  return parsed.kind() === 'ipv4'
    ? isPublicIPv4(parsed as ipaddr.IPv4)
    : isPublicIPv6(parsed as ipaddr.IPv6);
}

const FORBIDDEN_ADDRESS_MESSAGE =
  "Cette adresse désigne un réseau privé, local ou réservé : l'analyse n'est pas autorisée.";

/**
 * Resolves ALL A/AAAA addresses of `host` and refuses if any of them is not
 * public. IP literals are checked without DNS. Returns the resolved addresses.
 */
export async function resolveAndCheck(
  host: string,
  lookup: LookupAll = defaultLookup,
  options: GuardOptions = {},
): Promise<ResolvedAddress[]> {
  const h = normalizeHost(host);
  if (h === '') throw new AnalysisError('invalid_url');
  const literal = isIP(h);
  if (literal !== 0) {
    if (!options.allowPrivateHosts && !isPublicAddress(h)) {
      throw new AnalysisError('forbidden_target', FORBIDDEN_ADDRESS_MESSAGE);
    }
    return [{ address: h, family: literal === 6 ? 6 : 4 }];
  }
  if (!options.allowPrivateHosts && isForbiddenHostName(h)) {
    throw new AnalysisError('forbidden_target', FORBIDDEN_ADDRESS_MESSAGE);
  }
  let addresses: ResolvedAddress[];
  try {
    addresses = await lookup(h);
  } catch (error) {
    throw new AnalysisError('dns_failure', undefined, { cause: error });
  }
  if (addresses.length === 0) throw new AnalysisError('dns_failure');
  if (!options.allowPrivateHosts && addresses.some((a) => !isPublicAddress(a.address))) {
    throw new AnalysisError('forbidden_target', FORBIDDEN_ADDRESS_MESSAGE);
  }
  return addresses;
}

/** Full submission-time check: URL syntax + host name + every resolved address. */
export async function validateTarget(
  input: string,
  lookup: LookupAll = defaultLookup,
  options: GuardOptions = {},
): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  const url = parseAndValidateUrl(input, options);
  const addresses = await resolveAndCheck(url.hostname, lookup, options);
  return { url, addresses };
}
