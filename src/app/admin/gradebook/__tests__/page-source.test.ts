import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("admin gradebook counts use assignment section_id schema", async () => {
  const source = await readFile(
    join(process.cwd(), "src/app/admin/gradebook/page.tsx"),
    "utf8",
  );

  assert.match(source, /a\.section_id as section_id/i);
  assert.match(source, /group by a\.section_id/i);
  assert.doesNotMatch(source, /a\.course_section_id/i);
});
