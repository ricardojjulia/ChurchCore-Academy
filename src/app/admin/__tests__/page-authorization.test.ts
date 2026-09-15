import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

// Regression coverage for the admin-page authorization fix (PR #106): every page under
// src/app/admin/ previously called requireActor() with no role argument (authentication
// only), letting any authenticated user — including a student or guardian — load it. This
// asserts each page's source still contains its expected authorization check, so a future
// edit can't silently drop it back to the zero-arg form without a test failing.
//
// Source-assertion tests, not behavioral ones — this codebase's existing convention for
// page-level authorization coverage (see src/app/__tests__/working-surface-pages.test.ts,
// src/app/admin/gradebook/__tests__/page-source.test.ts) since there is no React rendering
// harness for Next.js Server Components in this test suite.

const repoRoot = process.cwd();

async function readPage(relativePath: string): Promise<string> {
  return readFile(join(repoRoot, relativePath), "utf8");
}

const requireActorPages: Array<{ path: string; roles: string[] }> = [
  { path: "src/app/admin/admissions/decisions/page.tsx", roles: ["institution_admin", "dean", "registrar", "admissions"] },
  { path: "src/app/admin/admissions/matriculation/page.tsx", roles: ["institution_admin", "dean", "registrar", "admissions"] },
  { path: "src/app/admin/admissions/page.tsx", roles: ["institution_admin", "dean", "registrar", "admissions"] },
  { path: "src/app/admin/alumni/page.tsx", roles: ["institution_admin", "academic_admin", "alumni_relations", "registrar"] },
  { path: "src/app/admin/alumni/[personId]/page.tsx", roles: ["institution_admin", "academic_admin", "alumni_relations", "registrar"] },
  { path: "src/app/admin/attendance/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/billing/page.tsx", roles: ["institution_admin", "finance", "registrar"] },
  { path: "src/app/admin/communications/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions", "finance"] },
  { path: "src/app/admin/courses/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/denomination/page.tsx", roles: ["institution_admin", "registrar"] },
  { path: "src/app/admin/denomination/[personId]/page.tsx", roles: ["institution_admin", "registrar"] },
  { path: "src/app/admin/financial-aid/page.tsx", roles: ["institution_admin", "finance", "registrar"] },
  { path: "src/app/admin/gradebook/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/graduation/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/groups/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/people/advisors/[id]/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/people/advisors/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/people/applicants/[id]/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/people/applicants/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/people/guardians/[id]/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/people/guardians/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/people/staff/[id]/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/people/staff/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/people/students/[id]/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/people/students/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/programs/[id]/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/programs/new/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/programs/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/reporting/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "finance"] },
  { path: "src/app/admin/sections/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/staff/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/students/[id]/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/students/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions"] },
  { path: "src/app/admin/transcripts/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/workflows/watchlist/page.tsx", roles: ["institution_admin", "registrar", "academic_admin", "advisor", "faculty"] },
];

const shepherdAiPages: string[] = [
  "src/app/admin/faculty/page.tsx",
  "src/app/admin/workflows/page.tsx",
];

const institutionConfigPages: string[] = [
  "src/app/admin/settings/calendar/page.tsx",
  "src/app/admin/settings/calendar/years/[id]/page.tsx",
  "src/app/admin/settings/compliance/page.tsx",
  "src/app/admin/settings/courses/page.tsx",
  "src/app/admin/settings/grading/page.tsx",
  "src/app/admin/settings/institution/page.tsx",
  "src/app/admin/settings/people/page.tsx",
];

for (const { path, roles } of requireActorPages) {
  test(`${path} requires an authorized role before rendering`, async () => {
    const source = await readPage(path);
    assert.match(
      source,
      /requireActor\(actor, \[/,
      `${path} no longer calls the two-arg requireActor(actor, [roles]) form`,
    );
    for (const role of roles) {
      assert.match(
        source,
        new RegExp(`["']${role}["']`),
        `${path} is missing expected role "${role}"`,
      );
    }
  });
}

for (const path of shepherdAiPages) {
  test(`${path} requires shared ShepherdAI read access before rendering`, async () => {
    const source = await readPage(path);
    assert.match(
      source,
      /assertShepherdAiAccess\(actor, actor\.tenantId, ["']read["']\)/,
      `${path} no longer calls assertShepherdAiAccess`,
    );
  });
}

for (const path of institutionConfigPages) {
  test(`${path} requires institution-config read access before rendering`, async () => {
    const source = await readPage(path);
    assert.match(
      source,
      /assertInstitutionConfigAccess\(actor, actor\.tenantId, ["']read["']\)/,
      `${path} no longer calls assertInstitutionConfigAccess`,
    );
  });
}

test("admin dashboard admits every staff role, not just leadership roles", async () => {
  // The dashboard no longer hand-types its own role list — a hand-typed copy previously
  // drifted from the layout's STAFF_ROLES and silently excluded ministry_formation_reviewer
  // (found via live-browser testing, see PR #107). It now imports STAFF_ROLES from
  // admin/layout.tsx directly, so checking that import plus STAFF_ROLES' own contents proves
  // the same invariant this test always cared about: every staff role reaches the dashboard.
  const pageSource = await readPage("src/app/admin/page.tsx");
  assert.match(
    pageSource,
    /requireActor\(actor, STAFF_ROLES\)/,
    "admin dashboard no longer gates on the shared STAFF_ROLES list",
  );
  assert.match(
    pageSource,
    /import \{ STAFF_ROLES \} from ["']@\/app\/admin\/layout["']/,
    "admin dashboard no longer imports STAFF_ROLES from the layout",
  );

  const layoutSource = await readPage("src/app/admin/layout.tsx");
  for (const role of ["faculty", "teacher", "professor", "advisor", "finance", "alumni_relations", "ministry_formation_reviewer"]) {
    assert.match(
      layoutSource,
      new RegExp(`["']${role}["']`),
      `STAFF_ROLES is missing staff role "${role}" — a staff member landing here after login would be blocked`,
    );
  }
});

test("admin layout enforces a baseline staff-only gate", async () => {
  const source = await readPage("src/app/admin/layout.tsx");
  assert.match(source, /requireActor\(actor, STAFF_ROLES\)/);
  assert.match(source, /AcademyAuthorizationError/);
});

test("admin layout does not redirect a blocked actor back through \"/\" (which redirects to /admin, looping)", async () => {
  const source = await readPage("src/app/admin/layout.tsx");
  assert.doesNotMatch(
    source,
    /redirect\(["']\/\?error=unauthorized["']\)/,
    "redirecting a non-staff actor to \"/\" loops, since \"/\" unconditionally redirects to \"/admin\" (see src/app/page.tsx)",
  );
  assert.match(source, /redirectTargetFor\(actor\)/);
});

test("root page still unconditionally redirects to /admin (documents the loop risk any future admin-gate redirect must avoid)", async () => {
  const source = await readPage("src/app/page.tsx");
  assert.match(source, /redirect\(["']\/admin["']\)/);
});

test("platform demo-feedback route stays outside the /admin layout gate", async () => {
  const source = await readPage("src/app/settings/demo-feedback/page.tsx");
  assert.match(
    source,
    /canAccessPlatformStaffWorkspace/,
  );
  assert.match(source, /export const dynamic = ["']force-dynamic["'];?/);
  assert.doesNotMatch(source, /@\/app\/admin\/settings\/demo-feedback\/page/);
});

test("admin-scoped demo-feedback page is removed so platform triage stays outside the academy layout", async () => {
  await assert.rejects(
    () => readPage("src/app/admin/settings/demo-feedback/page.tsx"),
    /ENOENT/,
  );
});

test("admin dashboard gates ShepherdAI reads behind the shared policy", async () => {
  const source = await readPage("src/app/admin/page.tsx");
  assert.match(source, /canAccessShepherdAi\(actor, actor\.tenantId, ["']read["']\)/);
});

test("program mutation APIs enforce catalog-admin roles", async () => {
  const createRoute = await readPage("src/app/api/academy/programs/route.ts");
  const detailRoute = await readPage("src/app/api/academy/programs/[id]/route.ts");
  for (const source of [createRoute, detailRoute]) {
    assert.match(
      source,
      /requireActor\(actor, \["institution_admin", "dean", "registrar", "academic_admin"\]\)/,
    );
  }
});

test("admin error boundary distinguishes an authorization denial from a real error", async () => {
  const source = await readPage("src/app/admin/error.tsx");
  assert.match(source, /Forbidden/);
  assert.match(source, /don&apos;t have access to this page/);
});

// Regression test for a real, previously-shipped bug found via live browser testing: four
// admin person-detail pages queried a table named `academy_audit_log`, which does not exist
// (the real table is `academy_audit_events`). The query's own try/catch swallowed the
// resulting Postgres error, but the surrounding transaction (shared across every query in the
// same withAcademyDatabaseContext callback) was left aborted — silently breaking every OTHER
// query later in the same request, including capability-gated tabs like Covenant Records and
// Denomination & Ordination, on pages where the broken audit query happened to run first.
for (const path of [
  "src/app/admin/people/staff/[id]/page.tsx",
  "src/app/admin/people/applicants/[id]/page.tsx",
  "src/app/admin/people/advisors/[id]/page.tsx",
  "src/app/admin/people/guardians/[id]/page.tsx",
]) {
  test(`${path} queries the real academy_audit_events table, not the nonexistent academy_audit_log`, async () => {
    const source = await readPage(path);
    assert.doesNotMatch(
      source,
      /academy_audit_log\b/,
      `${path} references academy_audit_log, which does not exist — this aborts the shared transaction and silently breaks every later query on the page`,
    );
  });
}

// Same root cause, different symptom: academy_audit_events has no `created_at` column (it's
// `occurred_at`). Referencing `created_at` against this specific table throws and poisons the
// transaction exactly like the wrong-table-name bug above.
for (const path of [
  "src/app/admin/people/students/[id]/page.tsx",
]) {
  test(`${path} orders academy_audit_events by its real occurred_at column`, async () => {
    const source = await readPage(path);
    assert.match(
      source,
      /academy_audit_events[\s\S]*?occurred_at/,
      `${path} queries academy_audit_events but doesn't reference its real occurred_at column — check it isn't still ordering by a nonexistent created_at column on this table`,
    );
  });
}

// Regression test for a real, previously-shipped bug found via live browser testing: this
// Next.js version resolves dynamic route `params` as a Promise, not a plain object. The staff
// and advisor detail pages still used the old synchronous `{ params: { id: string } }` shape
// and accessed `params.id` directly — this doesn't throw a build error, it silently resolves
// to `undefined` at request time, so the person lookup always failed and every visit 404'd.
// Every dynamic admin detail page must destructure params from an awaited Promise.
for (const path of [
  "src/app/admin/people/staff/[id]/page.tsx",
  "src/app/admin/people/advisors/[id]/page.tsx",
  "src/app/admin/people/students/[id]/page.tsx",
  "src/app/admin/formation/[studentId]/page.tsx",
]) {
  test(`${path} resolves dynamic route params as a Promise, not a plain object`, async () => {
    const source = await readPage(path);
    assert.match(
      source,
      /params: Promise<\{/,
      `${path} declares params as a plain object instead of a Promise — every request to this page will silently fail to resolve its id and 404`,
    );
    assert.doesNotMatch(
      source,
      /params\.\w+/,
      `${path} accesses params synchronously (e.g. params.id) instead of awaiting it first`,
    );
  });
}
