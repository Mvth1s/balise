import type { AnalysisErrorCode, AnalysisState, AnalysisStatus } from '@balise/analyzer/types';
import { formatDelay } from './format';

/** Client of the Balise API (contract in CLAUDE.md). */

export type ClientErrorCode = AnalysisErrorCode | 'network' | 'cancelled_by_user';

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  /** Seconds before a new attempt is allowed (429). */
  readonly retryAfter: number | null;

  constructor(
    code: ClientErrorCode,
    message: string,
    status = 0,
    retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export interface CreatedAnalysis {
  id: string;
  url: string;
  state: AnalysisState;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const KNOWN_CODES: readonly AnalysisErrorCode[] = [
  'invalid_url',
  'forbidden_target',
  'dns_failure',
  'rate_limited',
  'unreachable',
  'too_large',
  'not_html',
  'not_found',
  'preview_disabled',
  'internal',
];

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.round((date - Date.now()) / 1000));
}

async function toApiError(res: Response): Promise<ApiError> {
  let code: AnalysisErrorCode = res.status === 404 ? 'not_found' : 'internal';
  let message = '';
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    const c = body.error?.code;
    if (c && (KNOWN_CODES as readonly string[]).includes(c)) code = c as AnalysisErrorCode;
    message = typeof body.error?.message === 'string' ? body.error.message : '';
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 429) code = 'rate_limited';
  return new ApiError(code, message, res.status, parseRetryAfter(res.headers.get('Retry-After')));
}

async function request<T>(fetchImpl: FetchLike, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(path, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('network', '');
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function defaultFetch(): FetchLike {
  return (input, init) => fetch(input, init);
}

export function createAnalysis(url: string, fetchImpl = defaultFetch()): Promise<CreatedAnalysis> {
  return request<CreatedAnalysis>(fetchImpl, '/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

export function getAnalysis(
  id: string,
  signal?: AbortSignal,
  fetchImpl = defaultFetch(),
): Promise<AnalysisStatus> {
  return request<AnalysisStatus>(fetchImpl, `/api/analyses/${encodeURIComponent(id)}`, {
    signal: signal ?? null,
  });
}

export function cancelAnalysis(id: string, fetchImpl = defaultFetch()): Promise<void> {
  return request<void>(fetchImpl, `/api/analyses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function screenshotUrl(id: string): string {
  return `/api/analyses/${encodeURIComponent(id)}/screenshot`;
}

export const FINAL_STATES: readonly AnalysisState[] = ['done', 'error', 'cancelled'];

export function isFinalState(state: AnalysisState): boolean {
  return FINAL_STATES.includes(state);
}

export interface ErrorDescription {
  title: string;
  message: string;
}

/** Useful French message for every error code. */
export function describeError(
  code: ClientErrorCode,
  retryAfter: number | null = null,
): ErrorDescription {
  switch (code) {
    case 'invalid_url':
      return {
        title: 'Adresse invalide',
        message:
          'Vérifiez l’adresse saisie : elle doit commencer par http:// ou https:// et désigner une page web publique.',
      };
    case 'forbidden_target':
      return {
        title: 'Adresse refusée',
        message:
          'Balise n’analyse que les pages publiques. Les adresses de réseaux privés ou locaux, les adresses réservées et les ports non standard sont refusés pour des raisons de sécurité.',
      };
    case 'dns_failure':
      return {
        title: 'Nom de domaine introuvable',
        message:
          'Ce nom de domaine n’existe pas ou ne répond pas. Vérifiez l’orthographe de l’adresse.',
      };
    case 'rate_limited':
      return {
        title: 'Limite d’analyses atteinte',
        message:
          retryAfter !== null && retryAfter > 0
            ? `Vous avez atteint la limite de 10 analyses par heure. Vous pourrez lancer une nouvelle analyse dans ${formatDelay(retryAfter)}.`
            : 'Vous avez atteint la limite de 10 analyses par heure. Réessayez un peu plus tard.',
      };
    case 'unreachable':
      return {
        title: 'Page inaccessible',
        message:
          'Balise n’a pas pu charger cette page : le serveur ne répond pas, met trop de temps à répondre ou renvoie une erreur. Vérifiez qu’elle s’ouvre dans votre navigateur sans être connecté.',
      };
    case 'too_large':
      return {
        title: 'Page trop lourde',
        message:
          'La page dépasse la taille ou le nombre de ressources que Balise accepte de charger. Essayez une page plus légère du même site.',
      };
    case 'not_html':
      return {
        title: 'Ce n’est pas une page web',
        message:
          'L’adresse renvoie un fichier (PDF, image, document…) et non une page HTML. Balise n’analyse que des pages web.',
      };
    case 'not_found':
      return {
        title: 'Analyse introuvable ou expirée',
        message:
          'Cette analyse n’existe pas ou a été supprimée : les rapports sont conservés 30 jours. Vous pouvez relancer une analyse de la page.',
      };
    case 'preview_disabled':
      return {
        title: 'Analyse désactivée sur cette préversion',
        message:
          'Les déploiements de préversion de Balise n’exécutent pas d’analyse. Utilisez le site en production, https://balise-tau.vercel.app, ou consultez la page d’exemple.',
      };
    case 'network':
      return {
        title: 'Connexion impossible',
        message:
          'Balise ne parvient pas à joindre son serveur. Vérifiez votre connexion à Internet puis réessayez.',
      };
    case 'cancelled_by_user':
      return {
        title: 'Analyse annulée',
        message: 'Vous avez annulé cette analyse. Aucun rapport n’a été produit.',
      };
    case 'internal':
    default:
      return {
        title: 'Erreur inattendue',
        message:
          'Une erreur inattendue est survenue pendant l’analyse. Réessayez dans quelques instants ; si le problème persiste, signalez-le depuis la page Contact.',
      };
  }
}
