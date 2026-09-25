export class AcademyAuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AcademyAuthenticationError";
  }
}

// Production builds replace a Server Component error's message before it reaches the client,
// so error boundaries can't recognize a denial by message. Next.js keeps a digest that is
// already set on the thrown error, so every authorization denial carries this fixed digest.
export const ACADEMY_FORBIDDEN_DIGEST = "ACADEMY_FORBIDDEN";

export class AcademyAuthorizationError extends Error {
  readonly digest = ACADEMY_FORBIDDEN_DIGEST;

  constructor(message = "Forbidden Academy access.") {
    super(message);
    this.name = "AcademyAuthorizationError";
  }
}

export function isAuthorizationDenial(error: Error & { digest?: string }): boolean {
  // The message check covers development, where messages are not stripped.
  return error.digest === ACADEMY_FORBIDDEN_DIGEST || error.message.includes("Forbidden");
}

export class AcademyConflictError extends Error {
  constructor(message = "Academy record conflict.") {
    super(message);
    this.name = "AcademyConflictError";
  }
}
