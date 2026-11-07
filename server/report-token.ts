/**
 * Single-use, short-lived tokens that let the isolated Chromium worker hand
 * its report back to the API (the only code allowed to write to Redis).
 *
 * Format: base64url(JSON payload) "." base64url(Ed25519 signature).
 * The API holds the private key; the worker and the writer only need the
 * public key, so a compromised worker cannot mint tokens. Single use is
 * enforced by the writer, which atomically consumes the nonce stored in Redis.
 */
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

export interface ReportTokenPayload {
  id: string;
  url: string;
  /** Expiry, ms since epoch. */
  exp: number;
  nonce: string;
}

/** Slightly above the analysis hard limit (240 s), below the function maxDuration. */
export const REPORT_TOKEN_TTL_MS = 280_000;

const b64url = (buf: Buffer): string => buf.toString('base64url');

/** Keys come from the environment as base64 DER (PKCS#8 private, SPKI public). */
export function privateKeyFrom(base64Der: string): KeyObject {
  return createPrivateKey({ key: Buffer.from(base64Der, 'base64'), format: 'der', type: 'pkcs8' });
}

export function publicKeyFrom(base64Der: string): KeyObject {
  return createPublicKey({ key: Buffer.from(base64Der, 'base64'), format: 'der', type: 'spki' });
}

export function signReportToken(privateKey: KeyObject, payload: ReportTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload));
  return `${b64url(body)}.${b64url(sign(null, body, privateKey))}`;
}

/** Returns the payload of a valid, unexpired token, or null. */
export function verifyReportToken(
  publicKey: KeyObject,
  token: string,
  nowMs: number,
): ReportTokenPayload | null {
  if (token.length > 2048) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  try {
    const raw = Buffer.from(body, 'base64url');
    if (!verify(null, raw, publicKey, Buffer.from(signature, 'base64url'))) return null;
    const p = JSON.parse(raw.toString('utf8')) as Partial<ReportTokenPayload>;
    if (
      typeof p.id !== 'string' ||
      typeof p.url !== 'string' ||
      typeof p.nonce !== 'string' ||
      typeof p.exp !== 'number' ||
      p.exp <= nowMs
    ) {
      return null;
    }
    return { id: p.id, url: p.url, exp: p.exp, nonce: p.nonce };
  } catch {
    return null;
  }
}
