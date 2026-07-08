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
