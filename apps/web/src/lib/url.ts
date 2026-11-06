/**
 * Client-side URL validation: a usability aid only. The API performs the
 * authoritative checks (DNS resolution, private ranges, redirects).
 */

export type UrlProblem = 'empty' | 'scheme' | 'invalid' | 'host' | 'credentials' | 'private';

export type UrlValidation = { ok: true; url: string } | { ok: false; problem: UrlProblem };

const MAX_LENGTH = 2048;

function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a = 0, b = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.home.arpa')) return true;
  if (h.startsWith('[')) {
    const v6 = h.slice(1, -1);
    return (
      v6 === '::' ||
      v6 === '::1' ||
      v6.startsWith('fc') ||
      v6.startsWith('fd') ||
      v6.startsWith('fe80') ||
      v6.startsWith('::ffff:')
    );
  }
  return isPrivateIPv4(h);
}

/**
 * Validates and normalises what the user typed. "www.exemple.fr" is accepted
 * and becomes "https://www.exemple.fr/".
 */
export function validateUrl(input: string): UrlValidation {
  const raw = input.trim();
  if (raw === '') return { ok: false, problem: 'empty' };
  if (raw.length > MAX_LENGTH || /\s/.test(raw)) return { ok: false, problem: 'invalid' };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) {
    // "exemple.fr:8080" is a host with a port, not a scheme.
    if (!/^[^/:]+\.[^/:]+:\d+/.test(raw)) return { ok: false, problem: 'scheme' };
  }
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, problem: 'scheme' };
  }
  if (parsed.username || parsed.password) return { ok: false, problem: 'credentials' };
  const host = parsed.hostname;
  if (isLocalHostname(host)) return { ok: false, problem: 'private' };
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
  if (!isIp && !/^[^.]+(\.[^.]+)+\.?$/.test(host)) return { ok: false, problem: 'host' };
  return { ok: true, url: parsed.href };
}

export const URL_PROBLEM_MESSAGES: Record<UrlProblem, string> = {
  empty: 'Saisissez l’adresse de la page à analyser, par exemple https://www.exemple.fr/contact.',
  scheme: 'L’adresse doit commencer par http:// ou https://.',
  invalid:
    'Cette adresse n’est pas valide. Vérifiez qu’elle ne contient pas d’espace ni de caractère en trop.',
  host: 'Le nom de domaine semble incomplet. Exemple attendu : www.exemple.fr.',
  credentials:
    'Retirez l’identifiant et le mot de passe de l’adresse : Balise n’analyse que des pages publiques.',
  private:
    'Cette adresse désigne un réseau local ou privé. Balise n’analyse que des pages publiques, accessibles sur Internet.',
};
