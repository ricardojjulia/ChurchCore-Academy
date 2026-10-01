import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { fetchFacultyLoadWorkspace } from "../faculty-load";

const admin: AcademyActor = { tenantId: "tenant-a", userId: "admin-a", roles: ["academic_admin"] };

test("faculty load aggregates normalized period-scoped teaching evidence", async () => {
  const calls: unknown[][] = [];
  const result = await fetchFacultyLoadWorkspace(admin, "period-a", {
    async query(sql, values = []) {
      calls.push(values);
      assert.match(sql, /section\.academic_period_id = \$2/);
      assert.match(sql, /staff\.tenant_id = \$1/);
      return { rowCount: 2, rows: [
        { person_id: "faculty-a", faculty_name: "A Faculty", title: "Professor", load_policy: "standard", section_id: "section-1", section_code: "BIB-101-A", course_title: "Bible Survey", credits: "3", clock_hours: "45", capacity: 20, enrolled_seats: 18, advisee_count: 4 },
        { person_id: "faculty-a", faculty_name: "A Faculty", title: "Professor", load_policy: "standard", section_id: "section-2", section_code: "THE-201-A", course_title: "Theology", credits: "3", clock_hours: "45", capacity: 10, enrolled_seats: 12, advisee_count: 4 },
      ] };
    },
  });

  assert.deepEqual(calls[0], ["tenant-a", "period-a", ["faculty", "teacher", "professor"]]);
  assert.equal(result.faculty[0].sectionCount, 2);
  assert.equal(result.faculty[0].instructionalCredits, 6);
  assert.equal(result.faculty[0].enrolledSeats, 30);
  assert.equal(result.faculty[0].utilizationPercent, 100);
  assert.deepEqual(result.faculty[0].reviewFlags, ["Section enrollment exceeds capacity"]);
});

test("faculty load keeps zero-section faculty visible with explainable flags", async () => {
  const result = await fetchFacultyLoadWorkspace(admin, "period-a", {
    async query() {
      return { rowCount: 1, rows: [{ person_id: "faculty-b", faculty_name: "B Faculty", title: "Instructor", load_policy: null, section_id: null, advisee_count: 0 }] };
    },
  });
  assert.equal(result.faculty[0].sectionCount, 0);
  assert.deepEqual(result.faculty[0].reviewFlags, ["No sections in selected period", "Load policy not configured"]);
});

test("faculty load does not imply complete utilization when section configuration is missing", async () => {
  const result = await fetchFacultyLoadWorkspace(admin, "period-a", {
    async query() {
      return { rowCount: 1, rows: [{ person_id: "faculty-c", faculty_name: "C Faculty", title: "Teacher", load_policy: "standard", section_id: "section-3", section_code: "MIN-301-A", course_title: "Ministry", credits: null, clock_hours: null, capacity: null, enrolled_seats: 8, advisee_count: 0 }] };
    },
  });
  assert.equal(result.faculty[0].utilizationPercent, null);
  assert.deepEqual(result.faculty[0].reviewFlags, [
    "Credits not configured for every section",
    "Clock hours not configured for every section",
    "Capacity not configured for every section",
  ]);
});

test("faculty load returns an empty workspace when no academic period is selected", async () => {
  const result = await fetchFacultyLoadWorkspace(admin, null, { async query() { throw new Error("must not query"); } });
  assert.deepEqual(result, { periodId: null, faculty: [] });
});

test("faculty load rejects actors without oversight authority before querying", async () => {
  const faculty: AcademyActor = { tenantId: "tenant-a", userId: "faculty-a", roles: ["faculty"] };
  await assert.rejects(
    () => fetchFacultyLoadWorkspace(faculty, "period-a", { async query() { throw new Error("must not query"); } }),
    /requires academic oversight access/,
  );
});
