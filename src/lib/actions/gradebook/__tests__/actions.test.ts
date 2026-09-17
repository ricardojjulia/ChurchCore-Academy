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

test("submitGradeAction writes grade records through the authenticated tenant context", async () => {
  const { dependencies, queries, revalidated } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["faculty"],
    },
    [[{ can_write: true }], [{ id: "grade-record-1" }]],
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
  assert.match(queries[1].text, /insert into public\.academy_gradebook_records/i);
  assert.deepEqual(queries[1].values?.slice(0, 5), [
    "tenant-1",
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "student-1",
    "faculty-1",
  ]);
  assert.ok(revalidated.includes("/dashboard/student/grades"));

  // sensitivity_tier is no longer a client-trusted input (PR #126 review: a hardcoded/
  // client-chosen value could downgrade a pastoral/elevated assignment's grade to "standard"
  // sensitivity). It must be derived server-side from the assignment row via the join, not bound
  // as a query parameter.
  assert.doesNotMatch(queries[1].text, /\$10/);
  assert.match(queries[1].text, /assignment\.sensitivity_tier/i);
});

test("submitGradeAction reopens an already-posted record to draft on resubmission instead of silently mutating it", async () => {
  const { dependencies, queries } = createDependencies(
    {
      userId: "faculty-1",
      tenantId: "tenant-1",
      roles: ["faculty"],
    },
    [[{ can_write: true }], [{ id: "grade-record-1" }]],
  );

  await submitGradeAction(
    {
      submissionId: "00000000-0000-4000-8000-000000000001",
      assignmentId: "00000000-0000-4000-8000-000000000002",
      learnerPersonId: "student-1",
      pointsEarned: 85,
      maxPoints: 100,
    },
    dependencies,
  );

  // A resubmission (the on-conflict branch) must reopen the record to "draft" and clear its
  // posting metadata — otherwise a faculty member resubmitting a grade could silently change
  // points/letter grade on a record that is already posted and student-visible, without a fresh
  // registrar review. Found via PR #126 review.
  assert.match(queries[1].text, /on conflict \(tenant_id, submission_id\)/i);
  assert.match(queries[1].text, /posting_status = 'draft'/i);
  assert.match(queries[1].text, /posted_at = null/i);
  assert.match(queries[1].text, /posted_by_person_id = null/i);
  assert.match(queries[1].text, /released_to_student_at = null/i);
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
