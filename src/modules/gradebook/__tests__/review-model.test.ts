import assert from "node:assert/strict";
import test from "node:test";
import { buildGradebookReviewModel } from "@/modules/gradebook/review-model";
import type { GradebookReadModel } from "@/modules/gradebook/types";

const readModel: GradebookReadModel = {
  records: [
    {
      id: "record-1",
      submissionId: "submission-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Romans Reflection",
      courseId: "course-1",
      courseTitle: "Romans",
      sectionId: "section-1",
      sectionCode: "ROM-101-A",
      learnerPersonId: "student-1",
      learnerDisplayName: "Jane Learner",
      pointsEarned: 92,
      maxPoints: 100,
      percentage: 92,
      letterGrade: "A-",
      isPassing: true,
      instructorFeedback: "Strong work.",
      sensitivityTier: "standard",
      gradedAt: "2026-06-16T12:00:00.000Z",
      isOverridden: false,
      status: "graded",
      submittedAt: "2026-06-15T12:00:00.000Z",
      behavioralSignal: "On pace",
    },
    {
      id: "record-2",
      submissionId: "submission-2",
      assignmentId: "assignment-2",
      assignmentTitle: "Pastoral Practicum",
      courseId: "course-2",
      courseTitle: "Practicum",
      sectionId: "section-2",
      sectionCode: "PRA-201-A",
      learnerPersonId: "student-2",
      learnerDisplayName: "Sam Student",
      pointsEarned: 58,
      maxPoints: 100,
      percentage: 58,
      letterGrade: "F",
      isPassing: false,
      instructorFeedback: "Schedule a review.",
      sensitivityTier: "pastoral",
      gradedAt: "2026-06-16T12:00:00.000Z",
      isOverridden: true,
      status: "graded",
      submittedAt: "2026-06-15T12:00:00.000Z",
      behavioralSignal: "Needs support",
    },
  ],
  overrideAudit: [
    {
      id: "audit-1",
      gradeRecordId: "record-2",
      summaryId: null,
      overriddenByPersonId: "faculty-1",
      overriddenBy: "Prof. Smith",
      overrideType: "assignment_grade",
      reason: "Rubric correction.",
      overrideAt: "2026-06-16T13:00:00.000Z",
    },
  ],
};

test("gradebook review model builds metrics for admin and instructor views", () => {
  const model = buildGradebookReviewModel(readModel, "admin");

  assert.deepEqual(
    model.metrics.map((metric) => [metric.label, metric.value]),
    [
      ["Records", 2],
      ["Needs support", 1],
      ["Pastoral", 1],
      ["Overrides", 1],
    ],
  );
  assert.equal(model.records[0].displayGrade, "92%");
  assert.equal(model.records[1].sensitivityLabel, "Pastoral");
});

test("gradebook review model strips behavioral signals from learner view", () => {
  const model = buildGradebookReviewModel(readModel, "student");

  assert.equal(model.records[0].behavioralSignal, undefined);
  assert.equal(model.records[0].studentDisplay?.showRawScore, false);
  assert.match(model.records[1].studentDisplay?.contextStatement ?? "", /does not determine calling/i);
});
