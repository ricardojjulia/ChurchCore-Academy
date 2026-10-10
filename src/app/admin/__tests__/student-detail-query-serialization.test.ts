import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("student detail serializes queries on its request-scoped database client", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/admin/people/students/[id]/page.tsx"),
    "utf8",
  );

  assert.doesNotMatch(
    page,
    /Promise\.all\s*\(\s*\[[\s\S]*?client\.query/,
    "pg.Client queries must not overlap inside the request-scoped transaction",
  );
  assert.match(page, /const membershipResult = await client\.query/);
  assert.match(page, /const ordinationResult = await client\.query/);
  assert.match(page, /const denomNamesResult = await client\.query/);
  assert.match(page, /const alumniRecordResult = await client\.query/);
  assert.match(page, /const giftAggResult = await client\.query/);
});
