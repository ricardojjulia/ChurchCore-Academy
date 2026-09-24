import { PERSONAS, type PersonaKey } from "../personas";
import type { HttpMethod } from "../surfaces/discover";
import { KNOWN_ISSUES } from "../surfaces/known-issues";
import type { PageOutcome } from "../surfaces/classify";
import type { Access } from "../surfaces/types";

export type Who = PersonaKey | "anonymous";

export function isAllowed(access: Access, who: Who) {
  if (access === "public") return true;
  if (access === "cron" || access === "webhook") return false;
  return who !== "anonymous" && access.includes(who);
}

/** Why a page outcome is wrong for this persona, or null if it's right. */
export function pageViolation(access: Access, who: Who, outcome: PageOutcome, redirectsTo?: string): string | null {
  if (outcome.kind === "error") return `error screen: ${outcome.detail}`;
  if (redirectsTo && who !== "anonymous") {
    const ok = outcome.kind === "redirect" && (outcome.to === redirectsTo || outcome.to === PERSONAS[who].home);
    return ok ? null : `expected redirect to ${redirectsTo}, got ${describe(outcome)}`;
  }
  if (isAllowed(access, who)) {
    return outcome.kind === "ok" ? null : `expected the page, got ${describe(outcome)}`;
  }
  if (who === "anonymous") {
    return outcome.kind === "redirect" && outcome.to === "/login" ? null : `expected redirect to /login, got ${describe(outcome)}`;
  }
  if (outcome.kind === "denied" || outcome.kind === "not-found") return null;
  if (outcome.kind === "redirect" && outcome.to === PERSONAS[who].home) return null;
  return `expected access denied (or a redirect to ${PERSONAS[who].home}), got ${describe(outcome)}`;
}

/** Why an API status is wrong for this caller, or null if it's right. */
export function apiViolation(access: Access, who: Who, method: HttpMethod, status: number): string | null {
  if (status >= 500 && !(access === "webhook" && status === 503)) return `server error ${status}`;
  if (access === "public") return null;
  if (access === "cron" || access === "webhook") {
    return status === 401 || status === 400 || status === 405 || status === 503 ? null : `expected machine auth to reject, got ${status}`;
  }
  if (who === "anonymous") return status === 401 ? null : `expected 401 without a session, got ${status}`;
  if (isAllowed(access, who)) {
    // Allowed callers may still get 400/404/409 (sample record missing, empty body) but never
    // an auth rejection.
    return status === 401 || status === 403 ? `allowed caller rejected with ${status}` : null;
  }
  if (status < 400) return `${method} succeeded (${status}) for a caller outside the access list`;
  return status === 401 ? `signed-in caller got 401 (session not recognized)` : null;
}

export function knownIssueFor(surface: string, method: HttpMethod | "PAGE", who: Who) {
  return KNOWN_ISSUES.find(
    (known) => known.surface === surface && known.method === method && (known.personas === "all" || known.personas.includes(who)),
  );
}

function describe(outcome: PageOutcome) {
  return outcome.kind === "redirect" ? `redirect to ${outcome.to}` : outcome.kind;
}
