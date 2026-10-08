import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fetchSectionRosters } from "@/lib/academy-read-models";
import type { AcademyQueryClient } from "@/lib/academy-database-context";

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      return { rowCount: rows.length, rows };
    },
  } as unknown as AcademyQueryClient;
  return { client, calls };
}

test("section rosters are tenant-scoped and limited to the statuses attendance accepts", async () => {
  const { client, calls } = fakeClient([
    { course_section_id: "section-1", student_person_id: "person-1", full_name: "Lena Rivera" },
  ]);
  const roster = await fetchSectionRosters("tenant-a", ["section-1"], client);

  assert.deepEqual(roster, [{ courseSectionId: "section-1", studentPersonId: "person-1", fullName: "Lena Rivera" }]);
  assert.deepEqual(calls[0].values, ["tenant-a", ["section-1"]]);
  assert.match(calls[0].sql, /registration\.tenant_id = \$1/);
  assert.match(calls[0].sql, /registration\.status in \('pending_confirmation', 'registered'\)/);
});

test("section rosters skip the query when no sections are visible", async () => {
  const { client, calls } = fakeClient([]);
  assert.deepEqual(await fetchSectionRosters("tenant-a", [], client), []);
  assert.equal(calls.length, 0);
});

test("faculty attendance lists each section's roster by person id, not every student in the school", () => {
  const page = readFileSync("src/app/faculty/attendance/page.tsx", "utf8");
  assert.match(page, /fetchSectionRosters\(/);
  assert.doesNotMatch(page, /fetchStudentRecords/, "the page must not load every student in the tenant");

  const form = readFileSync("src/app/faculty/attendance/faculty-attendance-form.tsx", "utf8");
  assert.match(form, /rosters\[selectedSectionId\]/);
  assert.match(form, /studentPersonId: student\.personId/, "attendance is recorded by person id");
  assert.doesNotMatch(form, /student\.id\b/);
});

test("faculty attendance reports rejected records instead of claiming success", () => {
  const form = readFileSync("src/app/faculty/attendance/faculty-attendance-form.tsx", "utf8");
  assert.match(form, /if \(response\.ok\) return null;/);
  assert.match(form, /records were not saved/);
  assert.match(form, /role="alert"/);
  const css = readFileSync("src/styles/admin.css", "utf8");
  assert.match(css, /\.attendance-error-badge \{/, "the error badge class must be styled");
});
