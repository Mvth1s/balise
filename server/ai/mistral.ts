/**
 * Minimal Mistral La Plateforme client (chat completions, JSON schema output).
 * - at most 1 request per second (free plan limit), per function instance;
 * - retries 429 and 5xx with Retry-After or exponential backoff;
 * - hard overall deadline.
 * No SDK dependency: one fetch call.
 */
export const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
/**
 * Mistral Large 4, multimodal, with reasoning. The Experiment (free) plan
 * gives 0 request/min on mistral-small/medium and 2/min on ministral, 50/min
 * on this one (checked 2026-11-08). Override with MISTRAL_MODEL.
 */
export const DEFAULT_MISTRAL_MODEL = 'mistral-large-4';

export interface MistralDeps {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Minimum interval between two requests, ms. */
  minIntervalMs?: number;
  maxAttempts?: number;
}

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: string };

export interface ChatMessage {
  role: 'system' | 'user';
  content: string | ContentPart[];
}

export class MistralError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MistralError';
    this.status = status;
  }
}

let lastRequestAt = 0;

/** Test hook: forgets the throttle state. */
export function resetMistralThrottle(): void {
  lastRequestAt = 0;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Answer text: a string, or the `text` chunks of a reasoning answer (thinking chunks dropped). */
export function answerText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const text = content
    .filter(
      (c): c is { type: 'text'; text: string } => c?.type === 'text' && typeof c.text === 'string',
    )
    .map((c) => c.text)
    .join('');
  return text || null;
}

/** Sends one chat request and returns the parsed JSON content of the answer. */
export async function chatJson(
  deps: MistralDeps,
  messages: ChatMessage[],
  schema: { name: string; schema: Record<string, unknown> },
  signal: AbortSignal,
): Promise<unknown> {
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const interval = deps.minIntervalMs ?? 1100;
  const maxAttempts = deps.maxAttempts ?? 4;
  const body = JSON.stringify({
    model: deps.model,
    messages,
    temperature: 0,
    // Greedy sampling requires top_p 1; reasoning cannot be disabled on Large 4.
    top_p: 1,
    reasoning_effort: 'low',
    max_tokens: 8000,
    response_format: { type: 'json_schema', json_schema: { ...schema, strict: true } },
  });

  for (let attempt = 1; ; attempt += 1) {
    signal.throwIfAborted();
    const wait = lastRequestAt + interval - now();
    if (wait > 0) await sleep(wait);
    signal.throwIfAborted();
    lastRequestAt = now();
    const res = await fetchImpl(MISTRAL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${deps.apiKey}`,
      },
      body,
      signal,
      redirect: 'error',
    });
    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = answerText(data.choices?.[0]?.message?.content);
      if (content === null) throw new MistralError('réponse sans contenu');
      try {
        return JSON.parse(content) as unknown;
      } catch {
        throw new MistralError('réponse non JSON');
      }
    }
    const retryable = res.status === 429 || res.status >= 500;
    await res.body?.cancel().catch(() => undefined);
    if (!retryable || attempt >= maxAttempts) {
      throw new MistralError(`HTTP ${res.status}`, res.status);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** (attempt - 1),
    );
  }
}
