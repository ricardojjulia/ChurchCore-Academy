import assert from "node:assert/strict";
import test from "node:test";
import {
  GradebookPostgresRepository,
} from "@/modules/gradebook/postgres-repository";
import type { GradebookDatabase } from "@/modules/gradebook/postgres-repository";

function createDatabase(rowsByQuery: Record<string, unknown>[][] = []) {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  let index = 0;
  const database: GradebookDatabase = {
    async query(sql, values) {
      queries.push({ sql, values });
      return {
        rowCount: rowsByQuery[index]?.length ?? 0,
        rows: rowsByQuery[index++] ?? [],
      };
    },
  };

  return { database, queries };
}

test("admin gradebook read model loads tenant-scoped records and override audit", async () => {
  const { database, queries } = createDatabase([
    [
      {
        id: "record-1",
        submission_id: "submission-1",
        assignment_id: "assignment-1",
        assignment_title: "Romans Reflection",
        course_id: "course-1",
        course_title: "Romans",
        section_id: "section-1",
        section_code: "ROM-101-A",
        learner_person_id: "student-1",
        learner_display_name: "Jane Learner",
        points_earned: "92.00",
        max_points: "100.00",
        percentage: "92.00",
        letter_grade: "A-",
        is_passing: true,
        instructor_feedback: "Strong work.",
        sensitivity_tier: "standard",
        graded_at: new Date("2026-06-16T12:00:00Z"),
        is_overridden: false,
        status: "graded",
        submitted_at: new Date("2026-06-15T12:00:00Z"),
        behavioral_signal: "On pace",
      },
    ],
    [
      {
        id: "audit-1",
        grade_record_id: "record-1",
        summary_id: null,
        overridden_by_person_id: "faculty-1",
        overridden_by_display_name: "Prof. Smith",
        override_type: "assignment_grade",
        reason: "Rubric correction.",
        override_at: new Date("2026-06-16T13:00:00Z"),
      },
    ],
  ]);
  const repository = new GradebookPostgresRepository(database);

  const model = await repository.fetchAdminGradebook("tenant-1");

  assert.equal(model.records[0].learnerDisplayName, "Jane Learner");
  assert.equal(model.records[0].percentage, 92);
  assert.equal(model.overrideAudit[0].overriddenBy, "Prof. Smith");
  assert.match(queries[0].sql, /where record\.tenant_id = \$1/i);
  assert.deepEqual(queries[0].values, ["tenant-1"]);
  assert.match(queries[1].sql, /from public\.academy_gradebook_override_audit/i);
});

test("instructor gradebook read model filters to owned sections and optional learner context", async () => {
  const { database, queries } = createDatabase([[], [], []]);
  const repository = new GradebookPostgresRepository(database);

  await repository.fetchInstructorGradebook("tenant-1", "faculty-1", {
    learnerPersonId: "student-1",
  });

  assert.match(queries[0].sql, /section\.primary_instructor_id = \$2/i);
  assert.match(queries[0].sql, /section\.assistant_instructor_ids \? \$2/i);
  assert.match(queries[0].sql, /record\.learner_person_id = \$3/i);
  assert.deepEqual(queries[0].values, ["tenant-1", "faculty-1", "student-1"]);
});

test("instructor gradebook read model exposes grade entry targets for owned sections", async () => {
  const { database, queries } = createDatabase([
    [],
    [],
    [
      {
        submission_id: "submission-1",
        assignment_id: "assignment-1",
        assignment_title: "Romans Reflection",
        course_title: "Romans",
        section_code: "ROM-101-A",
        learner_person_id: "student-1",
        learner_display_name: "Jane Learner",
        max_points: "100.00",
        status: "submitted",
        submitted_at: new Date("2026-06-15T12:00:00Z"),
        sensitivity_tier: "standard",
      },
    ],
  ]);
  const repository = new GradebookPostgresRepository(database);

  const model = await repository.fetchInstructorGradebook("tenant-1", "faculty-1");

  assert.equal(model.gradingTargets?.[0].submissionId, "submission-1");
  assert.equal(model.gradingTargets?.[0].maxPoints, 100);
  assert.match(queries[2].sql, /from public\.academy_gradebook_submissions submission/i);
  assert.match(queries[2].sql, /record\.id is null/i);
  assert.match(queries[2].sql, /section\.primary_instructor_id = \$2/i);
});

test("learner gradebook read model filters to the authenticated learner only", async () => {
  const { database, queries } = createDatabase([[], []]);
  const repository = new GradebookPostgresRepository(database);

  await repository.fetchLearnerGradebook("tenant-1", "student-1");

  assert.match(queries[0].sql, /record\.learner_person_id = \$2/i);
  assert.match(queries[0].sql, /record\.posting_status = 'posted'/i);
  assert.match(queries[0].sql, /record\.released_to_student_at is not null/i);
  assert.deepEqual(queries[0].values, ["tenant-1", "student-1"]);
  assert.doesNotMatch(queries[0].sql, /behavioral_signal/i);
});

// ---------------------------------------------------------------------------
// gradeSubmission tests
//
// This is the second, older writer of academy_gradebook_records (the first,
// submitGradeAction, was fixed and reviewed in PR #126). It had no test coverage at all before
// this — consistent with it having no live UI caller either (GradeEntryForm.tsx, the only
// component that resembles a caller, actually posts through submitGradeAction, not this REST
// endpoint). Applying the same PR #126 fixes here as a follow-up: max_points/sensitivity_tier
// are derived from the assignment, not trusted from the caller, and a resubmission is rejected
// once the record is posted/held/revoked instead of silently overwriting it.
// ---------------------------------------------------------------------------

test("gradeSubmission creates a new record, deriving max_points and sensitivity_tier from the assignment", async () => {
  const { database, queries } = createDatabase([
    [{ tenant_id: "tenant-1", learner_person_id: "student-1", max_points: "100", sensitivity_tier: "pastoral" }],
    [{ id: "record-1", submission_id: "submission-1", assignment_id: "assignment-1", learner_person_id: "student-1", points_earned: "92.00", max_points: "100.00", percentage: "92.00", letter_grade: "A-", is_passing: true, instructor_feedback: null, sensitivity_tier: "pastoral", graded_at: new Date("2026-06-16T12:00:00Z"), is_overridden: false }],
  ]);
  const repository = new GradebookPostgresRepository(database);

  const result = await repository.gradeSubmission({
    tenantId: "tenant-1",
    submissionId: "submission-1",
    assignmentId: "assignment-1",
    learnerPersonId: "student-1",
    gradedByPersonId: "faculty-1",
    pointsEarned: 92,
    letterGrade: "A-",
    isPassing: true,
    instructorFeedback: null,
  });

  assert.equal(result.id, "record-1");
  assert.equal(result.sensitivityTier, "pastoral");
  assert.match(queries[0].sql, /from public\.academy_gradebook_submissions submission/i);
  assert.match(queries[1].sql, /insert into public\.academy_gradebook_records/i);
  assert.match(queries[1].sql, /on conflict \(tenant_id, submission_id\) do nothing/i);
  assert.deepEqual(queries[1].values, [
    "tenant-1",
    "submission-1",
    "assignment-1",
    "student-1",
    "faculty-1",
    92,
    100,
    "A-",
    true,
    null,
    "pastoral",
  ]);
});

test("gradeSubmission updates an existing draft record on resubmission", async () => {
  const { database, queries } = createDatabase([
    [{ tenant_id: "tenant-1", learner_person_id: "student-1", max_points: "100", sensitivity_tier: "standard" }],
    [], // INSERT ... ON CONFLICT DO NOTHING finds an existing row, returns nothing
    [{ id: "record-1", posting_status: "draft" }], // locked existing-row check
    [{ id: "record-1", submission_id: "submission-1", assignment_id: "assignment-1", learner_person_id: "student-1", points_earned: "70.00", max_points: "100.00", percentage: "70.00", letter_grade: null, is_passing: null, instructor_feedback: null, sensitivity_tier: "standard", graded_at: new Date("2026-06-16T12:00:00Z"), is_overridden: false }],
  ]);
  const repository = new GradebookPostgresRepository(database);

  const result = await repository.gradeSubmission({
    tenantId: "tenant-1",
    submissionId: "submission-1",
    assignmentId: "assignment-1",
    learnerPersonId: "student-1",
    gradedByPersonId: "faculty-1",
    pointsEarned: 70,
  });

  assert.equal(result.id, "record-1");
  assert.equal(result.pointsEarned, 70);
  assert.match(queries[2].sql, /select id, posting_status/i);
  assert.match(queries[2].sql, /for update/i);
  assert.match(queries[3].sql, /update public\.academy_gradebook_records/i);

  // The locked existing-row lookup must filter on assignment_id and learner_person_id too, not
  // just submission_id — academy_gradebook_records carries its own copies of those columns with
  // nothing in the schema enforcing they match the submission's real ones. Without this filter,
  // a pre-existing row with a stale/wrong association would still match on submission_id alone
  // and get updated by id, preserving the wrong assignment/learner association and corrupting
  // downstream GPA/reporting. Found via PR #131 review.
  assert.match(queries[2].sql, /assignment_id = \$3/i);
  assert.match(queries[2].sql, /learner_person_id = \$4/i);
  assert.deepEqual(queries[2].values, ["tenant-1", "submission-1", "assignment-1", "student-1"]);
});

test("gradeSubmission rejects resubmission of an already-posted record instead of silently overwriting it", async () => {
  const { database, queries } = createDatabase([
    [{ tenant_id: "tenant-1", learner_person_id: "student-1", max_points: "100", sensitivity_tier: "standard" }],
    [], // INSERT ... ON CONFLICT DO NOTHING finds an existing row, returns nothing
    [{ id: "record-1", posting_status: "posted" }], // locked existing-row check
  ]);
  const repository = new GradebookPostgresRepository(database);

  await assert.rejects(
    async () =>
      repository.gradeSubmission({
        tenantId: "tenant-1",
        submissionId: "submission-1",
        assignmentId: "assignment-1",
        learnerPersonId: "student-1",
        gradedByPersonId: "faculty-1",
        pointsEarned: 60,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      // AcademyConflictError, not a plain Error — handleApi only maps AcademyConflictError to
      // HTTP 409; a plain Error here was returned to callers as a generic 500
      // "Unexpected API error.", making it impossible to distinguish an expected state conflict
      // from a real server failure. Found via PR #131 review.
      assert.equal(error.name, "AcademyConflictError");
      assert.match(error.message, /already posted/i);
      return true;
    },
  );

  assert.equal(queries.length, 3);
  assert.ok(!queries.some((query) => /update public\.academy_gradebook_records/i.test(query.sql)));
});

test("gradeSubmission rejects a target whose submission does not belong to the claimed assignment/learner", async () => {
  const { database } = createDatabase([[]]);
  const repository = new GradebookPostgresRepository(database);

  await assert.rejects(
    async () =>
      repository.gradeSubmission({
        tenantId: "tenant-1",
        submissionId: "submission-1",
        assignmentId: "assignment-wrong",
        learnerPersonId: "student-1",
        gradedByPersonId: "faculty-1",
        pointsEarned: 60,
      }),
    /target not found/i,
  );
});

test("gradeSubmission rejects updating an existing record whose stored assignment/learner association doesn't match, instead of silently overwriting it", async () => {
  // Simulates a pre-existing academy_gradebook_records row that disagrees with its own
  // submission's real assignment/learner (possible from before this fix, when this same method
  // trusted caller-supplied values directly). The target-resolution query still validates and
  // passes (the submission itself is legitimate), the INSERT conflicts (a row already exists for
  // this submission_id), but the locked existing-row lookup — now filtered on assignment_id and
  // learner_person_id, not just submission_id — finds no matching row, since the stored row's
  // association doesn't match. This must be rejected as a data-integrity conflict, not silently
  // treated as "doesn't exist yet" (which would misleadingly suggest a fresh insert is safe) or
  // used as-is (which would preserve the wrong association). Found via PR #131 review.
  const { database, queries } = createDatabase([
    [{ tenant_id: "tenant-1", learner_person_id: "student-1", max_points: "100", sensitivity_tier: "standard" }],
    [], // INSERT ... ON CONFLICT DO NOTHING finds an existing row, returns nothing
    [], // locked existing-row check: no row matches (assignment_id/learner_person_id differ)
  ]);
  const repository = new GradebookPostgresRepository(database);

  await assert.rejects(
    async () =>
      repository.gradeSubmission({
        tenantId: "tenant-1",
        submissionId: "submission-1",
        assignmentId: "assignment-1",
        learnerPersonId: "student-1",
        gradedByPersonId: "faculty-1",
        pointsEarned: 60,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AcademyConflictError");
      assert.match(error.message, /does not match/i);
      return true;
    },
  );

  assert.equal(queries.length, 3);
  assert.ok(!queries.some((query) => /update public\.academy_gradebook_records/i.test(query.sql)));
});

test("gradeSubmission cross-tenant: a submission from another tenant cannot reach the write path", async () => {
  // The target-resolution query filters on tenant_id ($1); a submission from a different tenant
  // simply never matches, so it returns no row here (matching the mock's empty-first-query
  // fixture) — same outcome as a genuinely nonexistent submission, and the write path is never
  // reached. Required per CLAUDE.md's testing convention: every module function needs a
  // cross-tenant rejection case. Found via PR #131 review.
  const { database, queries } = createDatabase([[]]);
  const repository = new GradebookPostgresRepository(database);

  await assert.rejects(
    async () =>
      repository.gradeSubmission({
        tenantId: "tenant-2",
        submissionId: "submission-1",
        assignmentId: "assignment-1",
        learnerPersonId: "student-1",
        gradedByPersonId: "faculty-2",
        pointsEarned: 60,
      }),
    /target not found/i,
  );

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /submission\.tenant_id = \$1/i);
  assert.equal(queries[0].values?.[0], "tenant-2");
});
