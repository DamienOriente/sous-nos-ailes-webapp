/**
 * Application errors. Services throw these; the presentation layer maps them
 * to HTTP statuses / form errors. Messages are safe to show to the end user.
 */
export type AppErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "payment_required"
  | "unavailable"
  | "internal";

const statusByCode: Record<AppErrorCode, number> = {
  validation: 400,
  unauthenticated: 401,
  payment_required: 402,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Données invalides.", details?: Record<string, unknown>) {
    super("validation", message, details);
  }
}
export class UnauthenticatedError extends AppError {
  constructor(message = "Connexion requise.") {
    super("unauthenticated", message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "Vous n'avez pas accès à cette ressource.") {
    super("forbidden", message);
  }
}
/**
 * Not-found and forbidden intentionally share the same user-facing message for
 * private resources, so an attacker cannot enumerate identifiers.
 */
export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable.") {
    super("not_found", message);
  }
}
export class ConflictError extends AppError {
  constructor(message = "Cette opération entre en conflit avec l'état actuel.") {
    super("conflict", message);
  }
}
export class RateLimitedError extends AppError {
  constructor(message = "Trop de tentatives. Réessayez dans quelques instants.") {
    super("rate_limited", message);
  }
}
export class PaymentRequiredError extends AppError {
  constructor(message = "Cette fonctionnalité fait partie de l'offre Premium.") {
    super("payment_required", message);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Shape returned by server actions so forms can render field + global errors. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: AppErrorCode; fieldErrors?: Record<string, string[]> };

export function toActionError(e: unknown): ActionResult<never> {
  if (isAppError(e)) {
    return { ok: false, error: e.message, code: e.code };
  }
  return { ok: false, error: "Une erreur inattendue est survenue.", code: "internal" };
}
