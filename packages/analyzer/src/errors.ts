import type { AnalysisErrorCode } from './types.js';

/** Default French messages, safe to show to end users. */
export const ERROR_MESSAGES: Record<AnalysisErrorCode, string> = {
  invalid_url: "L'adresse saisie n'est pas une URL valide.",
  forbidden_target:
    "Cette adresse n'est pas analysable : seules les pages publiques en http ou https (ports 80 et 443) sont acceptées.",
  dns_failure: "Le nom de domaine de cette adresse n'a pas pu être résolu.",
  rate_limited: 'Vous avez atteint la limite de 10 analyses par heure. Réessayez plus tard.',
  unreachable: "La page n'a pas pu être chargée.",
  too_large: 'La page dépasse les limites de taille ou de nombre de ressources autorisées.',
  not_html: "L'adresse ne renvoie pas une page HTML.",
  not_found: "Cette analyse n'existe pas ou a expiré.",
  preview_disabled: "L'analyse est désactivée sur les déploiements de préversion.",
  internal: "Une erreur interne est survenue pendant l'analyse.",
};

/** Error carrying a stable code and a French, user-facing message. */
export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;

  constructor(
    code: AnalysisErrorCode,
    message: string = ERROR_MESSAGES[code],
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AnalysisError';
    this.code = code;
  }
}

/** Thrown when an analysis is cancelled through its AbortSignal. */
export class AnalysisAbortedError extends Error {
  constructor() {
    super("L'analyse a été annulée.");
    this.name = 'AnalysisAbortedError';
  }
}

export function isAnalysisError(error: unknown): error is AnalysisError {
  return error instanceof AnalysisError;
}

/** Converts any thrown value into an AnalysisError (unknown errors become `internal`). */
export function toAnalysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  return new AnalysisError('internal', ERROR_MESSAGES.internal, { cause: error });
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AnalysisAbortedError();
}
