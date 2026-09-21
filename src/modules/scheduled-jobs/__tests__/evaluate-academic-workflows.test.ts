import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";
import { academyDataset } from "@/modules/academy-data/mock-data";
import type { AcademyDataset } from "@/modules/academy-data/types";

function emptyDataset(): AcademyDataset {
  return {
    ...academyDataset,
    administrators: [],
    programs: [],
    students: [],
    faculty: [],
    sections: [],
  };
}

describe("runAcademicWorkflowEvaluationJob", () => {
  it("success: creates a workflow per known suggestion type, with the expected owner and side effects", async () => {
    const result = await runAcademicWorkflowEvaluationJob(
      academyDataset.tenantId,
      academyDataset,
      null,
    );

    assert.equal(result.dataset, academyDataset);
    assert.equal(result.repository.workflows.length, 4);

    const byOwner = new Map(
      result.repository.workflows.map((workflow) => [workflow.ownerUserId, workflow]),
    );

    const enrollment = byOwner.get("user-adrian");
    assert.ok(enrollment, "expected a workflow owned by user-adrian for incomplete_enrollment_follow_up");
    assert.equal(enrollment?.assignedToUserId, "user-adrian");
    assert.equal(enrollment?.status, "assigned");

    const faculty = result.repository.workflows.find((w) => w.ownerUserId === "user-sophia");
    assert.ok(faculty, "expected a workflow owned by user-sophia for faculty_or_course_assignment_imbalance_review");
    assert.equal(faculty?.status, "deferred");

    const documentationAndTranscript = result.repository.workflows.filter(
      (w) => w.ownerUserId === "user-regina",
    );
    assert.equal(documentationAndTranscript.length, 2);
    assert.ok(
      documentationAndTranscript.some((w) => w.status === "assigned"),
      "expected the missing_documentation_review workflow to remain assigned",
    );
    assert.ok(
      documentationAndTranscript.some((w) => w.status === "completed"),
      "expected the transcript_or_records_inconsistency_review workflow to be completed",
    );

    assert.equal(result.repository.workflowFeedback.length, 1);
    assert.equal(result.repository.workflowFeedback[0].feedbackType, "accepted");
  });

  it("boundary: creates no workflows when the dataset has no matching suggestions", async () => {
    const dataset = emptyDataset();

    const result = await runAcademicWorkflowEvaluationJob(dataset.tenantId, dataset, null);

    assert.equal(result.suggestions.length, 0);
    assert.equal(result.repository.workflows.length, 0);
    assert.equal(result.repository.workflowActions.length, 0);
    assert.equal(result.repository.workflowFeedback.length, 0);
  });

  it("does not touch persistence when persistenceOverride is explicitly null, even if DATABASE_URL is set", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://unreachable-host-for-test/db";

    try {
      // If the null override didn't take precedence, this would try to construct a real
      // ShepherdAiPostgresRepository and fail against the fake DATABASE_URL above.
      const result = await runAcademicWorkflowEvaluationJob(
        academyDataset.tenantId,
        academyDataset,
        null,
      );

      assert.equal(result.repository.workflows.length, 4);
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });
});
