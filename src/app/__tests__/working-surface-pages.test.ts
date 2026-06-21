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
  assert.match(page, /fetchProgramList/);
  assert.match(page, /\/admin\/programs\/\$\{program\.id\}/);
});

test("legacy root page redirects to admin portal", async () => {
  const page = await source("src/app/page.tsx");

  assert.match(page, /redirect\("\/admin"\)/);
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
