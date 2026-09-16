import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

// Regression coverage for a real bug found by the daily checkup's live browser walkthrough:
// CreatePeriodButton.tsx posted to /api/academy/periods (404 — no such route, ever) and
// PeriodActions.tsx's status transitions PATCHed /api/academy/periods/:id/status (also 404).
// Both silently broke period creation and every status transition (Open Enrollment / Activate /
// Complete) on the main /admin/settings/calendar page — the only surviving action was Delete,
// which already used the correct nested path. Source-assertion tests, not behavioral ones —
// this codebase's existing convention for client-component coverage (see
// src/app/admin/__tests__/page-authorization.test.ts) since there is no fetch-mocking harness
// wired up for these dialog/action components.

const repoRoot = process.cwd();

async function readSource(relativePath: string): Promise<string> {
  return readFile(join(repoRoot, relativePath), "utf8");
}

async function routeExists(relativePath: string): Promise<boolean> {
  try {
    await access(join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

test("CreatePeriodButton posts to the real nested create-period route, with a real periodType and sequence", async () => {
  const source = await readSource("src/app/admin/settings/calendar/CreatePeriodButton.tsx");

  assert.match(
    source,
    /fetch\(`\/api\/academy\/calendar\/years\/\$\{data\.academicYearId\}\/periods`/,
    "must POST to the year-scoped /api/academy/calendar/years/:yearId/periods route",
  );
  assert.doesNotMatch(
    source,
    /fetch\(["']\/api\/academy\/periods["']/,
    "must not POST to the nonexistent flat /api/academy/periods route",
  );
  assert.doesNotMatch(
    source,
    /Assuming ['"]term['"] for now/,
    "must not hardcode periodType — the form has to collect a real value",
  );
  assert.match(source, /name="periodType"/, "must collect periodType from the form");
  assert.match(source, /name="sequence"|register\(["']sequence["']/, "must collect sequence from the form");

  assert.ok(
    await routeExists("src/app/api/academy/calendar/years/[id]/periods/route.ts"),
    "the route this component posts to must actually exist",
  );
});

test("PeriodActions status transitions PATCH the real nested route", async () => {
  const source = await readSource("src/app/admin/settings/calendar/PeriodActions.tsx");

  assert.match(
    source,
    /fetch\(\s*`\/api\/academy\/calendar\/years\/\$\{period\.academicYearId\}\/periods\/\$\{period\.id\}\/status`/,
    "must PATCH the year-scoped /api/academy/calendar/years/:yearId/periods/:periodId/status route",
  );
  assert.doesNotMatch(
    source,
    /fetch\(`\/api\/academy\/periods\/\$\{period\.id\}\/status`/,
    "must not PATCH the nonexistent flat /api/academy/periods/:id/status route",
  );

  assert.ok(
    await routeExists(
      "src/app/api/academy/calendar/years/[id]/periods/[periodId]/status/route.ts",
    ),
    "the route this component PATCHes must actually exist",
  );
});

test("PeriodActions delete still uses the correct route (regression guard, was already correct)", async () => {
  const source = await readSource("src/app/admin/settings/calendar/PeriodActions.tsx");

  assert.match(
    source,
    /fetch\(`\/api\/academy\/calendar\/periods\/\$\{period\.id\}`/,
    "delete must keep using /api/academy/calendar/periods/:id",
  );

  assert.ok(
    await routeExists("src/app/api/academy/calendar/periods/[id]/route.ts"),
    "the route delete uses must actually exist",
  );
});
