/** Errors carrying a message safe to show to the acting user. */
export class DomainError extends Error {
  readonly code: string;
  constructor(message: string, code = "DOMAIN_ERROR") {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Élément introuvable.") {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = "Vous n’êtes pas autorisé·e à effectuer cette action.") {
    super(message, "FORBIDDEN");
    this.name = "AuthorizationError";
  }
}

export class ConflictError extends DomainError {
  readonly details: string[];
  constructor(message: string, details: string[] = []) {
    super(message, "CONFLICT");
    this.name = "ConflictError";
    this.details = details;
  }
}

export function userMessageFor(error: unknown, fallback = "Une erreur est survenue. Réessayez dans un instant."): string {
  if (error instanceof DomainError) return error.message;
  return fallback;
}
