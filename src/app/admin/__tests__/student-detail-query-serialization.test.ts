import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const requestScopedPages = [
  "src/app/admin/people/students/[id]/page.tsx",
  "src/app/admin/people/staff/[id]/page.tsx",
  "src/app/admin/denomination/[personId]/page.tsx",
  "src/app/admin/alumni/[personId]/page.tsx",
  "src/app/admin/formation/[studentId]/page.tsx",
  "src/app/student/formation/page.tsx",
  "src/app/admin/faculty/page.tsx",
  "src/app/faculty/page.tsx",
];

test("request-scoped pages serialize work on their PostgreSQL client", async () => {
  for (const pagePath of requestScopedPages) {
    const page = await readFile(path.join(process.cwd(), pagePath), "utf8");
    assert.doesNotMatch(
      page,
      /Promise\.all\s*\(/,
      `${pagePath} must not overlap work on its request-scoped pg.Client`,
    );
  }

  const page = await readFile(
    path.join(process.cwd(), "src/app/admin/people/students/[id]/page.tsx"),
    "utf8",
  );
  assert.match(page, /const membershipResult = await client\.query/);
  assert.match(page, /const ordinationResult = await client\.query/);
  assert.match(page, /const denomNamesResult = await client\.query/);
  assert.match(page, /const alumniRecordResult = await client\.query/);
  assert.match(page, /const giftAggResult = await client\.query/);
});
