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
  { path: "src/app/admin/attendance/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
  { path: "src/app/admin/billing/page.tsx", roles: ["institution_admin", "finance", "registrar"] },
  { path: "src/app/admin/communications/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin", "admissions", "finance"] },
  { path: "src/app/admin/courses/page.tsx", roles: ["institution_admin", "dean", "registrar", "academic_admin"] },
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
  const source = await readPage("src/app/admin/page.tsx");
  for (const role of ["faculty", "teacher", "professor", "advisor", "finance", "alumni_relations"]) {
    assert.match(
      source,
      new RegExp(`["']${role}["']`),
      `admin dashboard is missing staff role "${role}" — a staff member landing here after login would be blocked`,
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
