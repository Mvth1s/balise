import type { AnalysisReport, CriterionResult, JudgePack } from '@balise/analyzer';
import { beforeEach, describe, expect, it } from 'vitest';
import { enrichWithAi, validateJudgements } from './judge.ts';
import { chatJson, MISTRAL_URL, resetMistralThrottle } from './mistral.ts';

const crit = (id: string, status: CriterionResult['status'] = 'a-verifier'): CriterionResult => ({
  id,
  theme: Number(id.split('.')[0]),
  title: id,
  url: '',
  status,
  rules: [],
  findings: [],
});
const report = (criteria: CriterionResult[]): AnalysisReport =>
  ({ id: 'r', criteria }) as unknown as AnalysisReport;
const pack: JudgePack = {
  url: 'https://x.fr/',
  title: 'Accueil',
  lang: 'fr',
  images: [{ selector: '#logo', alt: 'image', inControl: null, context: 'Logo', jpeg: '/9j/AA==' }],
  links: [{ selector: '#l', text: 'Cliquez ici', href: '/a', context: 'Cliquez ici' }],
  headings: [],
  fields: [],
  buttons: [],
  frames: [],
  tables: [],
  passages: [],
};

/** Fake Mistral: answers from a queue, records calls and their times. */
function fakeMistral(
  answers: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>,
) {
  let t = 0;
  const calls: Array<{
    at: number;
    body: { messages: Array<{ content: unknown }>; response_format: unknown; model: string };
  }> = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    expect(String(url)).toBe(MISTRAL_URL);
    calls.push({ at: t, body: JSON.parse(String(init?.body)) });
    const a = answers.shift() ?? { status: 500 };
    return new Response(
      a.status && a.status !== 200
        ? 'err'
        : JSON.stringify({ choices: [{ message: { content: JSON.stringify(a.body) } }] }),
      { status: a.status ?? 200, headers: a.headers },
    );
  };
  return { fetch, calls, now: () => t, sleep: async (ms: number) => void (t += ms) };
}

beforeEach(() => resetMistralThrottle());

describe('enrichWithAi', () => {
  it('is disabled without MISTRAL_API_KEY', async () => {
    const m = fakeMistral([]);
    const r = report([crit('1.3'), crit('6.1')]);
    expect(await enrichWithAi(r, pack, {}, m)).toBe(r);
    expect(m.calls).toHaveLength(0);
  });

  it('makes at most two grouped calls, 1 s apart, and fills only open criteria', async () => {
    const m = fakeMistral([
      {
        body: {
          criteria: [
            {
              id: '1.3',
              verdict: 'non-conforme',
              confidence: 0.9,
              justification: '« image » ne décrit rien.',
              selectors: ['#logo', '#inventé'],
            },
          ],
        },
      },
      {
        body: {
          criteria: [
            {
              id: '6.1',
              verdict: 'non-conforme',
              confidence: 0.8,
              justification: 'Intitulé générique.',
              selectors: ['#l'],
            },
            {
              id: '8.6',
              verdict: 'conforme',
              confidence: 0.4,
              justification: 'Peu sûr.',
              selectors: [],
            },
          ],
        },
      },
    ]);
    const r = report([crit('1.3'), crit('6.1'), crit('8.6'), crit('1.2', 'conforme')]);
    const out = await enrichWithAi(r, pack, { MISTRAL_API_KEY: 'k' }, m);
    expect(m.calls).toHaveLength(2);
    expect(m.calls[1]!.at - m.calls[0]!.at).toBeGreaterThanOrEqual(1000);
    expect(m.calls[0]!.body.model).toBe('mistral-small-2603');
    expect(JSON.stringify(m.calls[0]!.body.messages)).toContain('data:image/jpeg;base64,/9j/AA==');
    expect(m.calls[0]!.body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { strict: true },
    });
    const byId = new Map(out.criteria.map((c) => [c.id, c]));
    expect(byId.get('1.3')).toMatchObject({
      status: 'non-conforme-ia',
      ai: { confidence: 0.9, model: 'mistral-small-2603', selectors: ['#logo'] },
    });
    expect(byId.get('6.1')?.status).toBe('non-conforme-ia');
    expect(byId.get('8.6')?.status).toBe('a-verifier'); // confidence below threshold
    expect(byId.get('1.2')?.status).toBe('conforme'); // automatic result wins
  });

  it('retries 429 after Retry-After, then gives up cleanly on errors', async () => {
    const m = fakeMistral([
      { status: 429, headers: { 'retry-after': '3' } },
      { body: { criteria: [] } },
      { status: 400 },
    ]);
    const r = report([crit('1.3'), crit('6.1')]);
    expect(await enrichWithAi(r, pack, { MISTRAL_API_KEY: 'k' }, m)).toBe(r);
    expect(m.calls[1]!.at - m.calls[0]!.at).toBeGreaterThanOrEqual(3000);
    expect(m.calls).toHaveLength(3);
  });

  it('stops at the deadline', async () => {
    const r = report([crit('6.1')]);
    const hanging: typeof fetch = (_u, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)),
      );
    const out = await enrichWithAi(
      r,
      pack,
      { MISTRAL_API_KEY: 'k' },
      { fetch: hanging, deadlineMs: 50 },
    );
    expect(out).toBe(r);
  });
});

describe('validateJudgements', () => {
  it('drops unknown ids, duplicates and malformed entries', () => {
    const out = validateJudgements(
      {
        criteria: [
          { id: '6.1', verdict: 'conforme', confidence: 0.7, justification: 'ok', selectors: [] },
          {
            id: '6.1',
            verdict: 'non-conforme',
            confidence: 0.9,
            justification: 'dup',
            selectors: [],
          },
          { id: '99.9', verdict: 'conforme', confidence: 1, justification: 'x', selectors: [] },
          { id: '8.6', verdict: 'peut-être', confidence: 1, justification: 'x', selectors: [] },
          { id: '9.1', verdict: 'conforme', confidence: 2, justification: 'x', selectors: [] },
        ],
      },
      ['6.1', '8.6', '9.1'],
    );
    expect(out.map((j) => j.id)).toEqual(['6.1']);
    expect(() => validateJudgements({}, ['6.1'])).toThrow();
  });

  it('chatJson rejects non-JSON content', async () => {
    const fetch: typeof globalThis.fetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'pas du json' } }] }));
    await expect(
      chatJson(
        { apiKey: 'k', model: 'm', fetch, minIntervalMs: 0 },
        [],
        { name: 'n', schema: {} },
        AbortSignal.timeout(1000),
      ),
    ).rejects.toThrow('réponse non JSON');
  });
});
