import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { overrideGradeAction } from "@/lib/actions/gradebook/overrideGradeAction";
import { postGradeAction } from "@/lib/actions/gradebook/postGradeAction";
import { submitGradeAction } from "@/lib/actions/gradebook/submitGradeAction";
import type {
  GradebookActionDependencies,
  GradebookQueryClient,
  GradebookQueryResult,
} from "@/lib/actions/gradebook/types";

function createDependencies(actor: AcademyActor, rowsByQuery: unknown[][] = []) {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  let index = 0;
  const client: GradebookQueryClient = {
    async query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<GradebookQueryResult<T>> {
      queries.push({ text, values });
      return {
        rowCount: 1,
        rows: (rowsByQuery[index++] ?? []) as unknown as T[],
      };
    },
  };
  const revalidated: string[] = [];
  const dependencies: GradebookActionDependencies = {
    async resolveActor() {
      return actor;
    },
    async runInDatabaseContext(_actor, operation) {
      return operation(client);
    },
    revalidate(path) {
      revalidated.push(path);
    },
  };

  return { dependencies, queries, revalidated };
}

test("submitGradeAction writes a new grade record through the authenticated tenant context", async () => {
  const { dependencies, queries, revalidated } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["faculty"],
    },
    [
      [{ can_write: true }],
      [{ tenant_id: "tenant-1", learner_person_id: "student-1", max_points: 100, sensitivity_tier: "elevated" }],
      [{ id: "grade-record-1" }],
    ],
  );

  const result = await submitGradeAction(
    {
      submissionId: "00000000-0000-4000-8000-000000000001",
      assignmentId: "00000000-0000-4000-8000-000000000002",
      learnerPersonId: "student-1",
      pointsEarned: 92,
      maxPoints: 100,
      letterGrade: "A-",
      isPassing: true,
      instructorFeedback: "Strong work.",
    },
    dependencies,
  );

  assert.deepEqual(result, { ok: true, data: { gradeRecordId: "grade-record-1" } });
  assert.match(queries[0].text, /academy_course_sections/i);

  // The submission/assignment/learner target is resolved (and its grading fields read) before
  // touching academy_gradebook_records at all.
  assert.match(queries[1].text, /from public\.academy_gradebook_submissions submission/i);
  assert.match(queries[1].text, /join public\.academy_gradebook_assignments assignment/i);
  assert.deepEqual(queries[1].values, [
    "tenant-1",
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "student-1",
  ]);

  assert.match(queries[2].text, /insert into public\.academy_gradebook_records/i);
  assert.match(queries[2].text, /on conflict \(tenant_id, submission_id\) do nothing/i);
  assert.deepEqual(queries[2].values, [
    "tenant-1",
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "student-1",
    "faculty-1",
    92,
    100,
    "A-",
    true,
    "Strong work.",
    // sensitivity_tier is no longer a client-trusted input (PR #126 review: a hardcoded/
    // client-chosen value could downgrade a pastoral/elevated assignment's grade to "standard"
    // sensitivity) — it's the value read from the assignment row, "elevated" here, not
    // whatever the client happened to pass (nothing, now — the field was removed).
    "elevated",
  ]);
  assert.ok(revalidated.includes("/dashboard/student/grades"));
});

test("submitGradeAction updates an existing draft record on resubmission", async () => {
  const { dependencies, queries } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["faculty"],
    },
    [
      [{ can_write: true }],
      [{ tenant_id: "tenant-1", learner_person_id: "student-1", max_points: 100, sensitivity_tier: "standard" }],
      [], // INSERT ... ON CONFLICT DO NOTHING finds an existing row, returns nothing
      [{ id: "grade-record-1", posting_status: "draft" }], // locked existing-row check
      [{ id: "grade-record-1" }], // UPDATE
    ],
  );

  const result = await submitGradeAction(
    {
      submissionId: "00000000-0000-4000-8000-000000000001",
      assignmentId: "00000000-0000-4000-8000-000000000002",
      learnerPersonId: "student-1",
      pointsEarned: 85,
      maxPoints: 100,
    },
    dependencies,
  );

  assert.deepEqual(result, { ok: true, data: { gradeRecordId: "grade-record-1" } });
  assert.match(queries[3].text, /select id, posting_status/i);
  assert.match(queries[3].text, /for update/i);
  assert.match(queries[4].text, /update public\.academy_gradebook_records/i);
  assert.match(queries[4].text, /points_earned = \$4/i);

  // The locked existing-row lookup must filter on assignment_id and learner_person_id too, not
  // just submission_id — academy_gradebook_records carries its own copies of those columns with
  // nothing in the schema enforcing they match the submission's real ones. Found via PR #131
  // review (of the sibling gradeSubmission fix; applied here since the gap is identical).
  assert.match(queries[3].text, /assignment_id = \$3/i);
  assert.match(queries[3].text, /learner_person_id = \$4/i);
  assert.deepEqual(queries[3].values, [
    "tenant-1",
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "student-1",
  ]);
});

test("submitGradeAction rejects updating an existing record whose stored assignment/learner association doesn't match", async () => {
  const { dependencies, queries } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["faculty"],
    },
    [
      [{ can_write: true }],
      [{ tenant_id: "tenant-1", learner_person_id: "student-1", max_points: 100, sensitivity_tier: "standard" }],
      [], // INSERT ... ON CONFLICT DO NOTHING finds an existing row, returns nothing
      [], // locked existing-row check: no row matches (assignment_id/learner_person_id differ)
    ],
  );

  const result = await submitGradeAction(
    {
      submissionId: "00000000-0000-4000-8000-000000000001",
      assignmentId: "00000000-0000-4000-8000-000000000002",
      learnerPersonId: "student-1",
      pointsEarned: 60,
      maxPoints: 100,
    },
    dependencies,
  );

  assert.equal(result.ok, false);
  assert.match(String((result as { error: string }).error), /does not match/i);
  assert.equal(queries.length, 4);
  assert.ok(!queries.some((query) => /update public\.academy_gradebook_records/i.test(query.text)));
});

test("submitGradeAction rejects resubmission of an already-posted record instead of silently mutating it", async () => {
  const { dependencies, queries } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["faculty"],
    },
    [
      [{ can_write: true }],
      [{ tenant_id: "tenant-1", learner_person_id: "student-1", max_points: 100, sensitivity_tier: "standard" }],
      [], // INSERT ... ON CONFLICT DO NOTHING finds an existing row, returns nothing
      [{ id: "grade-record-1", posting_status: "posted" }], // locked existing-row check
    ],
  );

  const result = await submitGradeAction(
    {
      submissionId: "00000000-0000-4000-8000-000000000001",
      assignmentId: "00000000-0000-4000-8000-000000000002",
      learnerPersonId: "student-1",
      pointsEarned: 60,
      maxPoints: 100,
    },
    dependencies,
  );

  // The previous version silently reopened any existing record to "draft" on resubmission —
  // that let a stale/direct call clear a registrar-held or -revoked record, or race a
  // concurrent post and undo it using outdated data. Now it's rejected outright: corrections to
  // a non-draft record must go through overrideGradeAction (audited, requires a reason) instead.
  // Found via PR #126 review.
  assert.equal(result.ok, false);
  // AcademyConflictError's message is surfaced directly by toGradebookActionError (PR #131
  // review's fix, applied to this sibling action too) instead of collapsing to the generic
  // "Gradebook write failed." — the caller can actually tell what happened and what to do next.
  assert.match(String((result as { error: string }).error), /already posted/i);
  assert.equal(queries.length, 4);
  assert.ok(!queries.some((query) => /update public\.academy_gradebook_records/i.test(query.text)));
});

test("submitGradeAction rejects grades outside instructor-owned sections", async () => {
  const { dependencies, queries } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["faculty"],
    },
    [[]],
  );

  const result = await submitGradeAction(
    {
      submissionId: "00000000-0000-4000-8000-000000000001",
      assignmentId: "00000000-0000-4000-8000-000000000002",
      learnerPersonId: "student-1",
      pointsEarned: 92,
      maxPoints: 100,
    },
    dependencies,
  );

  assert.equal(result.ok, false);
  assert.equal(queries.length, 1);
});

test("submitGradeAction rejects student write attempts before database work", async () => {
  const { dependencies, queries } = createDependencies({
    userId: "student-1",
    tenantId: "tenant-1",
    roles: ["student"],
  });

  const result = await submitGradeAction(
    {
      submissionId: "00000000-0000-4000-8000-000000000001",
      assignmentId: "00000000-0000-4000-8000-000000000002",
      learnerPersonId: "student-1",
      pointsEarned: 92,
      maxPoints: 100,
    },
    dependencies,
  );

  assert.equal(result.ok, false);
  assert.equal(queries.length, 0);
});

test("overrideGradeAction updates the grade and appends audit evidence in one database context", async () => {
  const { dependencies, queries, revalidated } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["teacher"],
    },
    [
      [{ can_write: true }],
      [{ id: "grade-record-1", points_earned: 80, letter_grade: "B", is_passing: true }],
    ],
  );

  const result = await overrideGradeAction(
    {
      gradeRecordId: "00000000-0000-4000-8000-000000000003",
      pointsEarned: 87,
      reason: "Correcting rubric calculation after faculty review.",
    },
    dependencies,
  );

  assert.deepEqual(result, {
    ok: true,
    data: {
      gradeRecordId: "00000000-0000-4000-8000-000000000003",
      auditWritten: true,
    },
  });
  assert.match(queries[0].text, /academy_course_sections/i);
  assert.match(queries[1].text, /for update/i);
  assert.match(queries[2].text, /update public\.academy_gradebook_records/i);
  assert.match(queries[3].text, /insert into public\.academy_gradebook_override_audit/i);
  assert.ok(revalidated.includes("/dashboard/admin/gradebook"));
});

test("overrideGradeAction rejects overrides outside instructor-owned sections", async () => {
  const { dependencies, queries } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["teacher"],
    },
    [[]],
  );

  const result = await overrideGradeAction(
    {
      gradeRecordId: "00000000-0000-4000-8000-000000000003",
      pointsEarned: 87,
      reason: "Correcting rubric calculation after faculty review.",
    },
    dependencies,
  );

  assert.equal(result.ok, false);
  assert.equal(queries.length, 1);
});

test("postGradeAction lets registrars post a graded record and appends audit evidence", async () => {
  const { dependencies, queries, revalidated } = createDependencies(
    {
      userId: "registrar-1",
      tenantId: "tenant-1",
      roles: ["registrar"],
    },
    [
      [
        {
          id: "00000000-0000-4000-8000-000000000004",
          posting_status: "draft",
        },
      ],
    ],
  );

  const result = await postGradeAction(
    {
      gradeRecordId: "00000000-0000-4000-8000-000000000004",
      releaseToStudent: true,
      reason: "Registrar review completed for official course posting.",
    },
    dependencies,
  );

  assert.deepEqual(result, {
    ok: true,
    data: {
      gradeRecordId: "00000000-0000-4000-8000-000000000004",
      postingStatus: "posted",
      auditWritten: true,
    },
  });
  assert.match(queries[0].text, /for update/i);
  assert.match(queries[1].text, /update public\.academy_gradebook_records/i);
  assert.match(queries[1].text, /posting_status = 'posted'/i);
  assert.match(queries[2].text, /insert into public\.academy_gradebook_posting_events/i);
  assert.ok(revalidated.includes("/dashboard/student/grades"));
});

test("postGradeAction rejects faculty posting attempts before database work", async () => {
  const { dependencies, queries } = createDependencies({
    userId: "faculty-1",
    tenantId: "tenant-1",
    roles: ["faculty"],
  });

  const result = await postGradeAction(
    {
      gradeRecordId: "00000000-0000-4000-8000-000000000004",
      releaseToStudent: true,
      reason: "Registrar review completed for official course posting.",
    },
    dependencies,
  );

  assert.equal(result.ok, false);
  assert.equal(queries.length, 0);
});
