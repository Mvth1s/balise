import { describe, expect, it } from 'vitest';
import { ApiError, createAnalysis, describeError, getAnalysis } from './api';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    }),
  );

describe('api client', () => {
  it('posts the URL and returns the created analysis', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const created = await createAnalysis('https://exemple.fr/', (url, init) => {
      calls.push([url, init]);
      return json(202, { id: 'a1', url: 'https://exemple.fr/', state: 'pending' });
    });
    expect(created.id).toBe('a1');
    expect(calls[0]?.[0]).toBe('/api/analyses');
    expect(calls[0]?.[1]?.body).toBe('{"url":"https://exemple.fr/"}');
  });

  it('maps API errors to typed codes, with Retry-After', async () => {
    const err = await createAnalysis('https://exemple.fr/', () =>
      json(429, { error: { code: 'rate_limited', message: 'x' } }, { 'Retry-After': '90' }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'rate_limited', status: 429, retryAfter: 90 });

    const notFound = await getAnalysis('x', undefined, () => json(404, {})).catch(
      (e: unknown) => e,
    );
    expect(notFound).toMatchObject({ code: 'not_found' });

    const network = await getAnalysis('x', undefined, () =>
      Promise.reject(new TypeError('x')),
    ).catch((e: unknown) => e);
    expect(network).toMatchObject({ code: 'network' });
  });

  it('describes every error in French', () => {
    expect(describeError('forbidden_target').title).toBe('Adresse refusée');
    expect(describeError('rate_limited', 120).message).toContain('2 minutes');
    expect(describeError('unreachable').message).toMatch(/charger cette page/);
  });
});
