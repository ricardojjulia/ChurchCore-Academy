import type { PersonaKey } from "../personas";
import type { HttpMethod } from "./discover";

/**
 * Who a surface is for. Everyone not listed must be kept out: for pages that means an
 * access-denied screen, a redirect to their own portal, or not-found; for APIs a 4xx.
 * Nobody may ever get an error screen or a 5xx.
 *  - "public": no session needed (applicant portal, login)
 *  - "cron": machine-only, authenticated by CRON_SECRET
 *  - "webhook": machine-only, authenticated by the provider's signature (Stripe)
 */
export type Access = "public" | "cron" | "webhook" | readonly PersonaKey[];

export interface PageEntry {
  path: string;
  access: Access;
  /** Legacy alias: signed-in users are sent here (then handled by the target's own rules). */
  redirectsTo?: string;
}

export interface ApiEntry {
  path: string;
  methods: Partial<Record<HttpMethod, Access>>;
}

/**
 * A real, tracked bug the sweep currently observes. The sweep treats a listed failure as
 * expected, and fails if it stops happening, so the entry is removed the day the bug is fixed.
 */
export interface KnownIssue {
  issue: string; // GitHub issue, e.g. "#169"
  surface: string; // manifest path
  method: HttpMethod | "PAGE";
  personas: readonly (PersonaKey | "anonymous")[] | "all";
  summary: string;
}
