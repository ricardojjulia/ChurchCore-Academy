import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

const MIGRATED_ROUTE_FILES = [
  "src/app/admin/programs/page.tsx",
  "src/app/admin/programs/new/page.tsx",
  "src/app/admin/programs/[id]/ProgramDetailClient.tsx",
  "src/app/admin/courses/page.tsx",
  "src/app/admin/sections/page.tsx",
];

test("programs and courses routes use ADR-0068 route-level design-system classes", async () => {
  for (const file of MIGRATED_ROUTE_FILES) {
    const page = await source(file);
    assert.doesNotMatch(page, /ops-(stats-grid|panel|metric|heading|icon|page-action-link)/, file);
    assert.doesNotMatch(page, /student-empty-state/, file);
    assert.match(page, /sis-route-/, file);
  }

  const styles = await source("src/styles/admin.css");
  for (const selector of [
    ".sis-route-stats-grid",
    ".sis-route-card",
    ".sis-route-metric",
    ".sis-route-heading",
    ".sis-route-icon",
    ".sis-route-empty",
    ".sis-route-action-link",
    ".sis-route-page-action",
  ]) {
    assert.match(styles, new RegExp(selector.replace(".", "\\.")));
  }
});

test("student detail page does not keep unused relationship row type aliases", async () => {
  const page = await source("src/app/admin/students/[id]/page.tsx");
  assert.doesNotMatch(page, /interface RelationshipRow/);
});

test("sections route exposes create and edit section workflows", async () => {
  const page = await source("src/app/admin/sections/page.tsx");
  assert.match(page, /SectionFormDialog/);
  assert.match(page, /courseOptions/);
  assert.match(page, /periodOptions/);
  assert.match(page, /instructorOptions/);

  const dialog = await source("src/app/admin/sections/SectionFormDialog.tsx");
  assert.match(dialog, /Create Section/);
  assert.match(dialog, /api\/academy\/sections/);
  assert.match(dialog, /method = mode === "create" \? "POST" : "PATCH"/);
  assert.match(dialog, /primaryInstructorId/);
  assert.match(dialog, /schedulePattern/);
  assert.match(dialog, /capacity/);
});

test("sections API routes support create and edit UI payloads", async () => {
  const createRoute = await source("src/app/api/academy/sections/route.ts");
  assert.match(createRoute, /titleOverride/);
  assert.match(createRoute, /schedulePattern/);
  assert.match(createRoute, /capacity/);
  assert.match(createRoute, /primaryInstructorId/);
  assert.match(createRoute, /withAcademyDatabaseContext/);

  const editRoute = await source("src/app/api/academy/sections/[id]/route.ts");
  assert.match(editRoute, /titleOverride/);
  assert.match(editRoute, /deliveryMode/);
  assert.match(editRoute, /schedulePattern/);
  assert.match(editRoute, /capacity/);
  assert.match(editRoute, /primaryInstructorRole/);
  assert.match(editRoute, /withAcademyDatabaseContext/);
});
