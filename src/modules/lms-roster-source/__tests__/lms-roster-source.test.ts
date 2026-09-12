import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOneRosterDatasetFromRosterSource,
  buildRosterSyncPlanInputFromSource,
  PostgresLmsRosterSourceRepository,
  type LmsRosterSourceSection,
} from "@/modules/lms-roster-source";

const section: LmsRosterSourceSection = {
  id: "section-1",
  tenantId: "tenant-1",
  institutionName: "Example Academy",
  courseId: "course-1",
  sectionCode: "BIBL-101-A",
  courseCode: "BIBL-101",
  courseTitle: "Biblical Foundations",
  sectionTitle: "Biblical Foundations A",
  academicPeriodId: "period-1",
  academicPeriodName: "Fall 2026",
  academicPeriodType: "term",
  academicPeriodStartsOn: "2026-08-24",
  academicPeriodEndsOn: "2026-12-12",
  academicYearCode: "2026",
  primaryInstructorId: "person-instructor-1",
  registrations: [
    { studentPersonId: "person-student-1", status: "registered", registeredOn: "2026-08-01" },
    { studentPersonId: "person-student-2", status: "pending_confirmation", registeredOn: "2026-08-02" },
    { studentPersonId: "person-student-3", status: "completed" },
    { studentPersonId: "person-student-4", status: "withdrawn" },
    { studentPersonId: "person-student-5", status: "waitlisted" },
  ],
  people: [
    {
      id: "person-instructor-1",
      displayName: "Ada Teacher",
      givenName: "Ada",
      familyName: "Teacher",
      email: "ada@example.edu",
      status: "active",
    },
    {
      id: "person-student-1",
      displayName: "Sam Learner",
      givenName: "Sam",
      familyName: "Learner",
      email: "sam@example.edu",
      status: "active",
    },
    {
      id: "person-student-2",
      displayName: "Pat Scholar",
      givenName: "Pat",
      familyName: "Scholar",
      status: "active",
    },
    {
      id: "person-student-3",
      displayName: "Chris Complete",
      givenName: "Chris",
      familyName: "Complete",
      status: "active",
    },
    {
      id: "person-student-4",
      displayName: "Wynn Withdrawn",
      givenName: "Wynn",
      familyName: "Withdrawn",
      status: "active",
    },
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

test("buildOneRosterDatasetFromRosterSource maps Academy roster source into canonical OneRoster rows", () => {
  const dataset = buildOneRosterDatasetFromRosterSource(section);

  assert.deepEqual(dataset.orgs, [
    {
      sourcedId: "tenant-1",
      name: "Example Academy",
      type: "school",
      identifier: "tenant-1",
    },
  ]);
  assert.deepEqual(dataset.academicSessions, [
    {
      sourcedId: "period-1",
      title: "Fall 2026",
      type: "term",
      startDate: "2026-08-24",
      endDate: "2026-12-12",
      schoolYear: "2026",
    },
  ]);
  assert.equal(dataset.users.length, 5);
  assert.equal(dataset.roles.filter((role) => role.role === "teacher").length, 1);
  assert.equal(dataset.enrollments.some((enrollment) => enrollment.userSourcedId === "person-student-5"), false);
  assert.equal(
    dataset.enrollments.find((enrollment) => enrollment.userSourcedId === "person-student-4")?.status,
    "tobedeleted",
  );
});

test("buildOneRosterDatasetFromRosterSource fails closed when a roster person cannot be exported", () => {
  assert.throws(
    () =>
      buildOneRosterDatasetFromRosterSource({
        ...section,
        people: section.people?.filter((person) => person.id !== "person-student-1"),
      }),
    /missing person person-student-1/,
  );
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
	              institution_name: "Example Academy",
	              course_id: "course-1",
	              section_code: "BIBL-101-A",
	              section_title: "Biblical Foundations A",
	              course_code: "BIBL-101",
	              course_title: "Biblical Foundations",
	              academic_period_id: "period-1",
	              academic_period_name: "Fall 2026",
	              academic_period_type: "term",
	              academic_period_starts_on: "2026-08-24",
	              academic_period_ends_on: "2026-12-12",
	              academic_year_code: "2026",
	              primary_instructor_id: "person-instructor-1",
	            },
	          ],
	        };
	      }
	      if (sql.includes("from academy_course_section_registrations")) {
        return {
	          rowCount: 2,
	          rows: [
	            { student_person_id: "person-student-1", status: "registered", registered_at: "2026-08-01T12:00:00.000Z" },
	            { student_person_id: "person-student-2", status: "completed", registered_at: "2026-08-02T12:00:00.000Z" },
	          ],
	        };
	      }
	      if (sql.includes("from academy_people")) {
	        return {
	          rowCount: 3,
	          rows: [
	            {
	              id: "person-instructor-1",
	              display_name: "Ada Teacher",
	              given_name: "Ada",
	              family_name: "Teacher",
	              email: "ada@example.edu",
	              phone: null,
	              person_status: "active",
	            },
	            {
	              id: "person-student-1",
	              display_name: "Sam Learner",
	              given_name: "Sam",
	              family_name: "Learner",
	              email: "sam@example.edu",
	              phone: null,
	              person_status: "active",
	            },
	            {
	              id: "person-student-2",
	              display_name: "Chris Complete",
	              given_name: "Chris",
	              family_name: "Complete",
	              email: "chris@example.edu",
	              phone: null,
	              person_status: "active",
	            },
	          ],
	        };
	      }
	      throw new Error(`Unexpected SQL: ${sql}`);
	    },
	  });

  const loaded = await repository.fetchSectionRosterSource("tenant-1", "section-1");

  assert.equal(loaded.id, "section-1");
	  assert.deepEqual(loaded.registrations, [
	    { studentPersonId: "person-student-1", status: "registered", registeredOn: "2026-08-01" },
	    { studentPersonId: "person-student-2", status: "completed", registeredOn: "2026-08-02" },
	  ]);
	  assert.deepEqual(loaded.people?.map((person) => person.id), [
	    "person-instructor-1",
	    "person-student-1",
	    "person-student-2",
	  ]);
	  assert.deepEqual(calls.map((call) => call.params), [
	    ["tenant-1", "section-1"],
	    ["tenant-1", "section-1"],
	    ["tenant-1", ["person-instructor-1", "person-student-1", "person-student-2"]],
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
