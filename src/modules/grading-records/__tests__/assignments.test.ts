import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  createAssignment,
  deleteAssignment,
  upsertSubmissionScore,
  submitDraftFinalGrade,
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

test("submitDraftFinalGrade() enters grade into gradebook course summaries", async () => {
  let insertedGrade: string | null = null;

  const db: AssignmentDatabase = {
    async query(sql: string, params?: unknown[]) {
      if (sql.includes("select course_id")) {
        return { rows: [{ course_id: "course-1", term_id: "term-1" }] };
      }
      if (sql.includes("primary_instructor_id")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("academy_program_enrollments")) {
        return { rows: [{ id: "enroll-1" }] };
      }
      if (sql.includes("academy_gradebook_course_summaries")) {
        // params[4] = final_letter_grade
        insertedGrade = params ? String(params[4]) : null;
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
  );

  assert.equal(result.letterGrade, "A");
  assert.equal(result.sectionId, "section-1");
  assert.equal(result.learnerPersonId, "student-1");
  assert.equal(insertedGrade, "A");
});
