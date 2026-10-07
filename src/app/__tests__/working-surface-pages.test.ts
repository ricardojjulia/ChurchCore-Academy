import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

test("admin students index renders protected records instead of redirecting", async () => {
  const page = await source("src/app/admin/students/page.tsx");

  assert.match(page, /requireActor/);
  assert.match(page, /fetchStudentRecords/);
  assert.match(page, /\/admin\/students\/\$\{student\.id\}/);
});

test("admin programs index renders protected records instead of redirecting", async () => {
  const page = await source("src/app/admin/programs/page.tsx");

  assert.match(page, /requireActor/);
  assert.match(page, /PostgresAcademicProgramRepository/);
  assert.match(page, /\/admin\/programs\/\$\{program\.id\}/);
});

test("root page redirects each signed-in user to their own portal", async () => {
  const page = await source("src/app/page.tsx");

  assert.match(page, /await requireActor\(\)/);
  assert.match(page, /redirect\(portalHomeFor\(actor\)\)/);
});

test("admin dashboard exposes navigation to all working MVP surfaces", async () => {
  const page = await source("src/app/admin/page.tsx");

  for (const label of ["Applications", "Student Records", "Programs", "ShepherdAI", "Faculty"]) {
    assert.match(page, new RegExp(label));
  }

  for (const href of [
    "/admin/admissions",
    "/admin/students",
    "/admin/programs",
    "/admin/workflows",
    "/admin/faculty",
    "/student",
  ]) {
    assert.match(page, new RegExp(href.replace("/", "\\/").replace("[", "\\[")));
  }
});

test("admin dashboard reads persisted dashboard data without invoking workflow evaluation", async () => {
  const page = await source("src/app/admin/page.tsx");

  assert.match(page, /requireActor/);
  assert.match(page, /withAcademyDatabaseContext/);
  assert.match(page, /ShepherdAiPostgresRepository/);
  assert.doesNotMatch(page, /runAcademicWorkflowEvaluationJob/);
  assert.doesNotMatch(page, /evaluation\?\.dataset/);
});

test("platform control page enforces platform staff access before rendering", async () => {
  const page = await source("src/app/platform/control/page.tsx");

  assert.match(page, /canAccessPlatformStaffWorkspace/);
  assert.match(page, /redirect\("\/"\)/);
  assert.match(page, /TenantControlPanel/);
});

test("HQ is concealed from ordinary navigation and protected before rendering", async () => {
  const wrapper = await source("src/components/academy/app-wrapper.tsx");
  const layout = await source("src/app/internal/hq/layout.tsx");
  const alias = await source("src/app/hq/page.tsx");

  assert.doesNotMatch(wrapper, /href:\s*["']\/hq["']/);
  assert.match(layout, /resolvePlatformRoles/);
  assert.match(layout, /canAccessPlatformStaffWorkspace/);
  assert.match(layout, /notFound\(\)/);
  assert.match(alias, /resolvePlatformRoles/);
  assert.match(alias, /canAccessPlatformStaffWorkspace/);
  assert.match(alias, /notFound\(\)/);
  assert.match(alias, /redirect\("\/internal\/hq"\)/);
});
