import { growthFrameFilter } from "@/lib/gradebook/growthFrameFilter";
import type {
  GradebookReadModel,
  GradebookRecordRead,
  GradebookReviewMetric,
  GradebookReviewModel,
  GradebookReviewRecord,
} from "@/modules/gradebook/types";
import type { GradebookVisibilityTier, SensitivityTier } from "@/types/gradebook";

function sensitivityLabel(value: SensitivityTier) {
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function displayGrade(record: GradebookRecordRead) {
  if (record.percentage === null) {
    return "Pending";
  }

  return `${Math.round(record.percentage)}%`;
}

function metric(label: string, value: number, detail: string): GradebookReviewMetric {
  return { label, value, detail };
}

function mapRecord(record: GradebookRecordRead, visibilityTier: GradebookVisibilityTier): GradebookReviewRecord {
  return {
    id: record.id,
    learnerDisplayName: record.learnerDisplayName,
    assignmentTitle: record.assignmentTitle,
    courseTitle: record.courseTitle,
    sectionCode: record.sectionCode ?? "All sections",
    status: record.status,
    displayGrade: displayGrade(record),
    sensitivityLabel: sensitivityLabel(record.sensitivityTier),
    isOverridden: record.isOverridden,
    ...(visibilityTier === "student" ? {} : { behavioralSignal: record.behavioralSignal ?? undefined }),
    ...(visibilityTier === "student"
      ? {
          studentDisplay: growthFrameFilter({
            assignmentTitle: record.assignmentTitle,
            percentage: record.percentage,
            letterGrade: record.letterGrade,
            isPassing: record.isPassing,
            instructorFeedback: record.instructorFeedback,
            sensitivityTier: record.sensitivityTier,
          }),
        }
      : {}),
  };
}

export function buildGradebookReviewModel(
  readModel: GradebookReadModel,
  visibilityTier: GradebookVisibilityTier,
): GradebookReviewModel {
  const records = readModel.records;

  return {
    visibilityTier,
    metrics: [
      metric("Records", records.length, "Posted grade records"),
      metric(
        "Needs support",
        records.filter((record) => record.isPassing === false).length,
        "Learners with non-passing records",
      ),
      metric(
        "Pastoral",
        records.filter((record) => record.sensitivityTier === "pastoral").length,
        "Pastoral-sensitive grade data",
      ),
      metric(
        "Overrides",
        readModel.overrideAudit.length,
        "Immutable override audit entries",
      ),
    ],
    records: records.map((record) => mapRecord(record, visibilityTier)),
    overrideAudit: readModel.overrideAudit,
    gradingTargets: readModel.gradingTargets ?? [],
  };
}
