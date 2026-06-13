export class AcademyAuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AcademyAuthenticationError";
  }
}

export class AcademyAuthorizationError extends Error {
  constructor(message = "Forbidden Academy access.") {
    super(message);
    this.name = "AcademyAuthorizationError";
  }
}
