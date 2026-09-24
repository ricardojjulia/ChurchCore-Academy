import type { KnownIssue } from "./types";

// Bugs the sweeps currently observe, each tracked by a GitHub issue. Remove an entry in the PR
// that fixes it; the sweep fails while a listed failure no longer happens.
export const KNOWN_ISSUES: KnownIssue[] = [];
