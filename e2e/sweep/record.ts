import { mkdirSync, writeFileSync } from "node:fs";

/**
 * With E2E_RECORD_VIOLATIONS=1 the sweeps write every violation to e2e/.auth/violations/ and
 * pass, instead of failing. scripts/e2e/draft-known-issues.ts turns that into known-issue
 * drafts. Used when adopting the suite or after a large change, never in CI.
 */
export const RECORDING = Boolean(process.env.E2E_RECORD_VIOLATIONS);

export function recordViolations(surface: string, kind: "page" | "api", problems: string[]) {
  if (!problems.length) return;
  mkdirSync("e2e/.auth/violations", { recursive: true });
  writeFileSync(`e2e/.auth/violations/${kind}${surface.replace(/[^a-z0-9]+/gi, "_")}.json`, JSON.stringify({ surface, kind, problems }));
}
