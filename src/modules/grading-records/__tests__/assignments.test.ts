import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  createAssignment,
  deleteAssignment,
  upsertSubmissionScore,
  submitDraftFinalGrade,
  getSectionFinalGradeStatus,
  GradeDeadlineError,
  type AssignmentDatabase,
} from "@/modules/grading-records/assignment-service";

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

const faculty: AcademyActor = {
  tenantId: "tenant-1",
  userId: "faculty-1",
  roles: ["faculty"],
};

const facultyOtherSection: AcademyActor = {
  tenantId: "tenant-1",
  userId: "faculty-other",
  roles: ["faculty"],
};

const facultyOtherTenant: AcademyActor = {
  tenantId: "tenant-2",
  userId: "faculty-x",
  roles: ["faculty"],
};

const student: AcademyActor = {
  tenantId: "tenant-1",
  userId: "student-1",
  roles: ["student"],
};

// ---------------------------------------------------------------------------
// In-memory database helper
// ---------------------------------------------------------------------------

interface DbRow {
  [key: string]: unknown;
}

function makeAssignmentRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "assign-1",
    tenant_id: "tenant-1",
    course_id: "course-1",
    section_id: "section-1",
    created_by_person_id: "faculty-1",
    title: "Week 1 Quiz",
    description: null,
    assignment_type: "quiz",
    max_points: 100,
    weight: 1.0,
    due_date: null,
    is_published: false,
    sensitivity_tier: "standard",
    created_at: "2026-06-22T00:00:00.000Z",
    updated_at: "2026-06-22T00:00:00.000Z",
    ...overrides,
  };
}

function makeSubmissionRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "sub-1",
    tenant_id: "tenant-1",
    assignment_id: "assign-1",
    learner_person_id: "student-1",
    status: "graded",
    submitted_at: "2026-06-22T00:00:00.000Z",
    updated_at: "2026-06-22T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Builds a mock AssignmentDatabase.
 *
 * queryMap: a map of partial SQL keyword → array of rows to return.
 * The first matching key wins.
 */
function makeDb(
  queryMap: Array<{ match: string | RegExp; rows: DbRow[] }> = [],
  _ops: { deleted?: string[] } = {},
): AssignmentDatabase {
  return {
    async query(sql: string, _params?: unknown[]) {
      for (const { match, rows } of queryMap) {
        const matched =
          typeof match === "string" ? sql.includes(match) : match.test(sql);
        if (matched) return { rows };
      }
      return { rows: [] };
    },
  };
}

// ---------------------------------------------------------------------------
// T2-07: createAssignment() success
// ---------------------------------------------------------------------------

test("createAssignment() creates an assignment for faculty's own section", async () => {
  const db = makeDb([
    // Section lookup (tenant isolation)
    { match: "select course_id", rows: [{ course_id: "course-1" }] },
    // Section ownership check
    { match: "primary_instructor_id", rows: [{ "?column?": 1 }] },
    // Insert returning
    { match: "returning", rows: [makeAssignmentRow()] },
  ]);

  const result = await createAssignment(db, faculty, {
    sectionId: "section-1",
    title: "Week 1 Quiz",
    assignmentType: "quiz",
    maxPoints: 100,
  });

  assert.equal(result.title, "Week 1 Quiz");
  assert.equal(result.assignmentType, "quiz");
  assert.equal(result.maxPoints, 100);
  assert.equal(result.tenantId, "tenant-1");
  assert.equal(result.sectionId, "section-1");
});

// ---------------------------------------------------------------------------
// T2-07: createAssignment() wrong section
// ---------------------------------------------------------------------------

test("createAssignment() rejects faculty who are not assigned to the section", async () => {
  const db = makeDb([
    // Section belongs to tenant (tenant isolation passes)
    { match: "select course_id", rows: [{ course_id: "course-1" }] },
    // But faculty is NOT in this section's instructor list
    { match: "primary_instructor_id", rows: [] },
  ]);

  await assert.rejects(
    () =>
      createAssignment(db, facultyOtherSection, {
        sectionId: "section-1",
        title: "Unauthorized Quiz",
        assignmentType: "quiz",
        maxPoints: 50,
      }),
    /not assigned as an instructor for this section/i,
  );
});

// ---------------------------------------------------------------------------
// T2-07: createAssignment() cross-tenant rejection
// ---------------------------------------------------------------------------

test("createAssignment() rejects faculty from a different tenant", async () => {
  // Section query returns empty because tenant-2 has no section with that id under tenant-1
  const db = makeDb([
    { match: "select course_id", rows: [] },
  ]);

  await assert.rejects(
    () =>
      createAssignment(db, facultyOtherTenant, {
        sectionId: "section-1",
        title: "Cross-tenant Quiz",
        assignmentType: "quiz",
        maxPoints: 50,
      }),
    /Section not found or does not belong to your institution/i,
  );
});

// ---------------------------------------------------------------------------
// T2-07: createAssignment() non-instructor role rejected
// ---------------------------------------------------------------------------

test("createAssignment() rejects non-instructor roles", async () => {
  const db = makeDb([]);

  await assert.rejects(
    () =>
      createAssignment(db, student, {
        sectionId: "section-1",
        title: "Student attempt",
        assignmentType: "quiz",
        maxPoints: 10,
      }),
    /Only instructors may create assignments/i,
  );
});

// ---------------------------------------------------------------------------
// T2-07: upsertSubmissionScore() success
// ---------------------------------------------------------------------------

test("upsertSubmissionScore() saves score for a valid assignment", async () => {
  const db = makeDb([
    // Assignment + deadline query (no deadline)
    {
      match: "grade_submission_deadline",
      rows: [
        {
          id: "assign-1",
          section_id: "section-1",
          max_points: 100,
          grade_submission_deadline: null,
        },
      ],
    },
    // Section ownership
    { match: "primary_instructor_id", rows: [{ "?column?": 1 }] },
    // Upsert submission
    { match: "academy_gradebook_submissions", rows: [makeSubmissionRow()] },
  ]);

  const result = await upsertSubmissionScore(db, faculty, {
    assignmentId: "assign-1",
    learnerPersonId: "student-1",
    score: 85,
  });

  assert.equal(result.submission.assignmentId, "assign-1");
  assert.equal(result.submission.learnerPersonId, "student-1");
  assert.equal(result.warning, undefined);
});

// ---------------------------------------------------------------------------
// T2-07: upsertSubmissionScore() deadline passed
// ---------------------------------------------------------------------------

test("upsertSubmissionScore() throws GradeDeadlineError when deadline has passed", async () => {
  const pastDeadline = new Date(Date.now() - 86_400_000).toISOString(); // yesterday

  const db = makeDb([
    {
      match: "grade_submission_deadline",
      rows: [
        {
          id: "assign-1",
          section_id: "section-1",
          max_points: 100,
          grade_submission_deadline: pastDeadline,
        },
      ],
    },
  ]);

  await assert.rejects(
    () =>
      upsertSubmissionScore(db, faculty, {
        assignmentId: "assign-1",
        learnerPersonId: "student-1",
        score: 90,
      }),
    GradeDeadlineError,
  );
});

// ---------------------------------------------------------------------------
// T2-07: weight > 100% — no error, returns warning
// ---------------------------------------------------------------------------

test("upsertSubmissionScore() allows extra-credit score (above max_points) with a warning", async () => {
  const db = makeDb([
    {
      match: "grade_submission_deadline",
      rows: [
        {
          id: "assign-1",
          section_id: "section-1",
          max_points: 100,
          grade_submission_deadline: null,
        },
      ],
    },
    { match: "primary_instructor_id", rows: [{ "?column?": 1 }] },
    { match: "academy_gradebook_submissions", rows: [makeSubmissionRow({ status: "graded" })] },
  ]);

  const result = await upsertSubmissionScore(db, faculty, {
    assignmentId: "assign-1",
    learnerPersonId: "student-1",
    score: 110, // extra credit — 10 above max
  });

  assert.equal(result.warning, true);
  assert.ok(result.warningMessage?.includes("extra credit"));
});

// ---------------------------------------------------------------------------
// T2-07: deleteAssignment() success
// ---------------------------------------------------------------------------

test("deleteAssignment() removes the assignment and its submissions", async () => {
  const deletedTables: string[] = [];

  const db: AssignmentDatabase = {
    async query(sql: string, _params?: unknown[]) {
      if (sql.includes("select section_id")) {
        return { rows: [{ section_id: "section-1", created_by_person_id: "faculty-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("delete from public.academy_gradebook_submissions")) {
        deletedTables.push("submissions");
        return { rows: [] };
      }
      if (sql.includes("delete from public.academy_gradebook_assignments")) {
        deletedTables.push("assignments");
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  await deleteAssignment(db, faculty, "assign-1");

  assert.ok(deletedTables.includes("submissions"), "Submissions should be deleted");
  assert.ok(deletedTables.includes("assignments"), "Assignment should be deleted");
  // Submissions must be deleted before the assignment (FK constraint)
  assert.ok(
    deletedTables.indexOf("submissions") < deletedTables.indexOf("assignments"),
    "Submissions must be deleted before the assignment",
  );
});

// ---------------------------------------------------------------------------
// T2-07: submitDraftFinalGrade() success
// ---------------------------------------------------------------------------

// academy_course_sections has no term_id column (only academic_period_id), and
// academy_program_enrollments has no course_id/person_id columns at all (it's a program-level
// enrollment: academic_program_id, catalog_academic_year_id, student_person_id). Both of
// submitDraftFinalGrade's original queries referenced columns that have never existed, so this
// function has failed outright on every call since it was written — it had zero callers
// anywhere in the codebase, so the mismatch was never caught. Fixed to resolve the section by
// course_id only, and the student's enrollment via their section-scoped registration
// (academy_course_section_registrations), the authoritative link to both the program enrollment
// and this specific section. Found while wiring the first real caller for this function.

test("submitDraftFinalGrade() enters the grade into gradebook course summaries and completes the registration", async () => {
  let insertedGrade: string | null = null;
  let insertedIsPassing: unknown = undefined;
  let insertSql: string | null = null;
  let completedRegistrationId: string | null = null;

  const db: AssignmentDatabase = {
    async query(sql: string, params?: unknown[]) {
      if (sql.includes("select course_id") && sql.includes("academy_course_sections")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("academy_course_section_registrations") && sql.includes("select id, program_enrollment_id")) {
        return { rows: [{ id: "registration-1", program_enrollment_id: "enroll-1" }] };
      }
      if (sql.includes("select id from public.academy_transcript_entries")) {
        return { rows: [] }; // not yet posted to the transcript
      }
      if (sql.includes("from public.academy_gradebook_records record")) {
        return { rows: [{ id: "grade-record-1" }] }; // a posted assignment grade exists
      }
      if (sql.includes("insert into public.academy_gradebook_course_summaries")) {
        // params[4] = final_letter_grade, params[5] = is_passing
        insertSql = sql;
        insertedGrade = params ? String(params[4]) : null;
        insertedIsPassing = params ? params[5] : undefined;
        return { rows: [] };
      }
      if (sql.includes("update public.academy_course_section_registrations")) {
        // params[1] = registration id
        completedRegistrationId = params ? String(params[1]) : null;
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const result = await submitDraftFinalGrade(
    db,
    faculty,
    "section-1",
    "student-1",
    "A",
    true,
  );

  assert.equal(result.letterGrade, "A");
  assert.equal(result.sectionId, "section-1");
  assert.equal(result.learnerPersonId, "student-1");
  assert.equal(result.isPassing, true);
  assert.equal(insertedGrade, "A");
  assert.equal(insertedIsPassing, true);
  assert.equal(completedRegistrationId, "registration-1");
  // The summary's unique constraint is (tenant_id, enrollment_id, course_id) — enrollment_id
  // alone is the student's PROGRAM enrollment and can span multiple courses, so a conflict
  // target of (tenant_id, enrollment_id) only would let a second course's submission silently
  // overwrite the first course's summary row. See migration
  // 20260917030000_final_grade_submission_fixes.sql.
  assert.match(insertSql ?? "", /on conflict \(tenant_id, enrollment_id, course_id\)/);
});

test("submitDraftFinalGrade() rejects a letter grade longer than 8 characters", async () => {
  const db: AssignmentDatabase = {
    async query() {
      throw new Error("should not query the database before the letterGrade length check");
    },
  };

  await assert.rejects(
    async () => submitDraftFinalGrade(db, faculty, "section-1", "student-1", "A".repeat(9), true),
    /must be between 1 and 8 characters/i,
  );
});

test("submitDraftFinalGrade() rejects students from submitting final grades", async () => {
  const db: AssignmentDatabase = {
    async query() {
      throw new Error("should not query the database before the role check");
    },
  };

  await assert.rejects(
    async () => submitDraftFinalGrade(db, student, "section-1", "student-1", "A", true),
    /Only instructors/i,
  );
});

test("submitDraftFinalGrade() rejects faculty who don't own the section", async () => {
  const db: AssignmentDatabase = {
    async query(sql: string) {
      if (sql.includes("select course_id") && sql.includes("academy_course_sections")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [] }; // not this faculty member's section
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => submitDraftFinalGrade(db, facultyOtherSection, "section-1", "student-1", "A", true),
    /not assigned as an instructor/i,
  );
});

test("submitDraftFinalGrade() rejects a student with no active registration in this section", async () => {
  const db: AssignmentDatabase = {
    async query(sql: string) {
      if (sql.includes("select course_id") && sql.includes("academy_course_sections")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("academy_course_section_registrations") && sql.includes("select id, program_enrollment_id")) {
        return { rows: [] }; // no registration found
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => submitDraftFinalGrade(db, faculty, "section-1", "student-1", "A", true),
    /was not found/i,
  );
});

test("submitDraftFinalGrade() rejects a registration with no program enrollment (e.g. K-12 grade-band)", async () => {
  const db: AssignmentDatabase = {
    async query(sql: string) {
      if (sql.includes("select course_id") && sql.includes("academy_course_sections")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("academy_course_section_registrations") && sql.includes("select id, program_enrollment_id")) {
        // Some registrations legitimately have no program enrollment at all (seeded in
        // 20260624060000_seed_demo_multi_institution_showcase.sql: "no program enrollment
        // needed for K-12 grade bands") — confirmed against real local data.
        return { rows: [{ id: "registration-1", program_enrollment_id: null }] };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => submitDraftFinalGrade(db, faculty, "section-1", "student-1", "A", true),
    /must have a program enrollment/i,
  );
});

test("submitDraftFinalGrade() rejects resubmission once the course has already been posted to the transcript", async () => {
  const db: AssignmentDatabase = {
    async query(sql: string) {
      if (sql.includes("select course_id") && sql.includes("academy_course_sections")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("academy_course_section_registrations") && sql.includes("select id, program_enrollment_id")) {
        return { rows: [{ id: "registration-1", program_enrollment_id: "enroll-1" }] };
      }
      if (sql.includes("select id from public.academy_transcript_entries")) {
        // Already posted to the immutable transcript — a resubmission here would silently
        // update the mutable draft summary while the posted record stays frozen and correct,
        // leaving the two permanently disagreeing.
        return { rows: [{ id: "entry-1" }] };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => submitDraftFinalGrade(db, faculty, "section-1", "student-1", "A", true),
    /already been posted/i,
  );
});

test("submitDraftFinalGrade() rejects when no posted assignment grade exists for this student in this section", async () => {
  const db: AssignmentDatabase = {
    async query(sql: string) {
      if (sql.includes("select course_id") && sql.includes("academy_course_sections")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("academy_course_section_registrations") && sql.includes("select id, program_enrollment_id")) {
        return { rows: [{ id: "registration-1", program_enrollment_id: "enroll-1" }] };
      }
      if (sql.includes("select id from public.academy_transcript_entries")) {
        return { rows: [] };
      }
      if (sql.includes("from public.academy_gradebook_records record")) {
        // academy_transcript_entries.source_grade_record_id is NOT NULL — without at least one
        // posted assignment grade, the registrar's candidate query (its inner lateral join)
        // would never find this student, no matter how "completed" the registration says it is.
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => submitDraftFinalGrade(db, faculty, "section-1", "student-1", "A", true),
    /at least one assignment grade must be posted/i,
  );
});

test("submitDraftFinalGrade() cross-tenant: rejects a section that does not belong to the actor's tenant", async () => {
  const db: AssignmentDatabase = {
    async query(sql: string) {
      if (sql.includes("select course_id") && sql.includes("academy_course_sections")) {
        return { rows: [] }; // tenant_id filter excludes it
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => submitDraftFinalGrade(db, facultyOtherTenant, "section-1", "student-1", "A", true),
    /not found or does not belong/i,
  );
});

// ---------------------------------------------------------------------------
// getSectionFinalGradeStatus()
// ---------------------------------------------------------------------------

test("getSectionFinalGradeStatus() returns each registration's final-grade submission status", async () => {
  const db: AssignmentDatabase = {
    async query(sql: string) {
      if (sql.includes("select id from public.academy_course_sections")) {
        return { rows: [{ id: "section-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("from public.academy_course_section_registrations reg")) {
        return {
          rows: [
            {
              registration_id: "registration-1",
              learner_person_id: "student-1",
              registration_status: "completed",
              final_letter_grade: "A",
              is_passing: true,
            },
            {
              registration_id: "registration-2",
              learner_person_id: "student-2",
              registration_status: "registered",
              final_letter_grade: null,
              is_passing: null,
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await getSectionFinalGradeStatus(db, faculty, "section-1");

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    studentRegistrationId: "registration-1",
    learnerPersonId: "student-1",
    registrationStatus: "completed",
    finalLetterGrade: "A",
    isPassing: true,
  });
  assert.deepEqual(result[1], {
    studentRegistrationId: "registration-2",
    learnerPersonId: "student-2",
    registrationStatus: "registered",
    finalLetterGrade: undefined,
    isPassing: undefined,
  });
});

test("getSectionFinalGradeStatus() rejects students from viewing final-grade status", async () => {
  const db: AssignmentDatabase = {
    async query() {
      throw new Error("should not query the database before the role check");
    },
  };

  await assert.rejects(
    async () => getSectionFinalGradeStatus(db, student, "section-1"),
    /Only instructors and admins/i,
  );
});

test("getSectionFinalGradeStatus() cross-tenant: rejects a section that does not belong to the actor's tenant", async () => {
  const db: AssignmentDatabase = {
    async query(sql: string) {
      if (sql.includes("select id from public.academy_course_sections")) {
        return { rows: [] }; // tenant_id filter excludes it
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => getSectionFinalGradeStatus(db, facultyOtherTenant, "section-1"),
    /not found or does not belong/i,
  );
});
