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
  assert.deepEqual(queries[0].values, ["tenant-1", "student-1"]);
  assert.doesNotMatch(queries[0].sql, /behavioral_signal/i);
});
