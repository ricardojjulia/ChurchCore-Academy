import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";

test("mock course section uses Academy person id for gradebook instructor ownership", () => {
  const section = academyDataset.courseCatalog.sections.find(
    (item) => item.id === "section-reading-k5",
  );

  assert.equal(section?.primaryInstructorId, "person-sophia-marsh");
});

test("local seed includes deterministic gradebook assignments and submissions", async () => {
  const source = await readFile(
    new URL("../../academy-data/postgres-repository.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /academy_gradebook_assignments/i);
  assert.match(source, /academy_gradebook_submissions/i);
  assert.match(source, /academy_gradebook_records/i);
  assert.match(source, /Reading Fluency Reflection/i);
});
