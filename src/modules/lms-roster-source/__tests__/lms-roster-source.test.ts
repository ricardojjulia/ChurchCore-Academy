import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRosterSyncPlanInputFromSource,
  PostgresLmsRosterSourceRepository,
  type LmsRosterSourceSection,
} from "@/modules/lms-roster-source";

const section: LmsRosterSourceSection = {
  id: "section-1",
  tenantId: "tenant-1",
  courseId: "course-1",
  sectionCode: "BIBL-101-A",
  courseCode: "BIBL-101",
  courseTitle: "Biblical Foundations",
  academicPeriodId: "period-1",
  primaryInstructorId: "person-instructor-1",
  registrations: [
    { studentPersonId: "person-student-1", status: "registered" },
    { studentPersonId: "person-student-2", status: "pending_confirmation" },
    { studentPersonId: "person-student-3", status: "completed" },
    { studentPersonId: "person-student-4", status: "withdrawn" },
    { studentPersonId: "person-student-5", status: "waitlisted" },
  ],
};

test("buildRosterSyncPlanInputFromSource derives LMS roster input from real section registrations", () => {
  const input = buildRosterSyncPlanInputFromSource(section, "idem-roster-section-1");

  assert.equal(input.sectionId, "section-1");
  assert.deepEqual(input.instructorPersonIds, ["person-instructor-1"]);
  assert.deepEqual(input.studentPersonIds, [
    "person-student-1",
    "person-student-2",
    "person-student-3",
    "person-student-4",
  ]);
  assert.deepEqual(input.enrollmentStates, {
    "person-student-1": "active",
    "person-student-2": "active",
    "person-student-3": "completed",
    "person-student-4": "withdrawn",
  });
  assert.equal(input.idempotencyKey, "idem-roster-section-1");
});

test("buildRosterSyncPlanInputFromSource excludes blank instructors and duplicate student rows", () => {
  const input = buildRosterSyncPlanInputFromSource(
    {
      ...section,
      primaryInstructorId: undefined,
      registrations: [
        { studentPersonId: "person-student-1", status: "registered" },
        { studentPersonId: "person-student-1", status: "registered" },
        { studentPersonId: "person-student-2", status: "waitlisted" },
      ],
    },
    "idem-dedupe",
  );

  assert.deepEqual(input.instructorPersonIds, []);
  assert.deepEqual(input.studentPersonIds, ["person-student-1"]);
  assert.deepEqual(input.enrollmentStates, { "person-student-1": "active" });
});

test("repository loads one tenant-scoped section with registration history", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const repository = new PostgresLmsRosterSourceRepository({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("from academy_course_sections s")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "section-1",
              tenant_id: "tenant-1",
              course_id: "course-1",
              section_code: "BIBL-101-A",
              course_code: "BIBL-101",
              course_title: "Biblical Foundations",
              academic_period_id: "period-1",
              primary_instructor_id: "person-instructor-1",
            },
          ],
        };
      }
      if (sql.includes("from academy_course_section_registrations")) {
        return {
          rowCount: 2,
          rows: [
            { student_person_id: "person-student-1", status: "registered" },
            { student_person_id: "person-student-2", status: "completed" },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const loaded = await repository.fetchSectionRosterSource("tenant-1", "section-1");

  assert.equal(loaded.id, "section-1");
  assert.deepEqual(loaded.registrations, [
    { studentPersonId: "person-student-1", status: "registered" },
    { studentPersonId: "person-student-2", status: "completed" },
  ]);
  assert.deepEqual(calls.map((call) => call.params), [
    ["tenant-1", "section-1"],
    ["tenant-1", "section-1"],
  ]);
});

test("repository throws a safe not-found error for out-of-tenant sections", async () => {
  const repository = new PostgresLmsRosterSourceRepository({
    query: async () => ({ rowCount: 0, rows: [] }),
  });

  await assert.rejects(
    () => repository.fetchSectionRosterSource("tenant-1", "other-section"),
    /Course section was not found./,
  );
});
