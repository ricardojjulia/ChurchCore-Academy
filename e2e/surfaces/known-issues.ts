import type { KnownIssue } from "./types";

// Bugs the sweeps currently observe, each tracked by a GitHub issue. Remove an entry in the PR
// that fixes it; the sweep fails while a listed failure no longer happens. Generated from a
// recorded sweep by scripts/e2e/draft-known-issues.ts — see docs/testing/e2e-suite.md.
export const KNOWN_ISSUES: KnownIssue[] = [
];
