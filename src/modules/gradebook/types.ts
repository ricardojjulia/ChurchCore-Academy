import type {
  GradebookVisibilityTier,
  SensitivityTier,
  SubmissionStatus,
} from "@/types/gradebook";
import type { GradebookOverrideAuditEntry } from "@/components/academy/gradebook/OverrideAuditLog";
import type { GradeDisplayOutput } from "@/types/gradebook";

export interface GradebookRecordRead {
  id: string;
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  sectionId: string | null;
  sectionCode: string | null;
  learnerPersonId: string;
  learnerDisplayName: string;
  pointsEarned: number | null;
  maxPoints: number;
  percentage: number | null;
  letterGrade: string | null;
  isPassing: boolean | null;
  instructorFeedback: string | null;
  sensitivityTier: SensitivityTier;
  gradedAt: string;
  isOverridden: boolean;
  status: SubmissionStatus;
  submittedAt: string | null;
  behavioralSignal?: string | null;
}

export interface GradebookAuditRead extends GradebookOverrideAuditEntry {
  gradeRecordId: string | null;
  summaryId: string | null;
  overriddenByPersonId: string;
}

export interface GradebookReadModel {
  records: GradebookRecordRead[];
  overrideAudit: GradebookAuditRead[];
}

export interface GradebookReviewMetric {
  label: string;
  value: number;
  detail: string;
}

export interface GradebookReviewRecord {
  id: string;
  learnerDisplayName: string;
  assignmentTitle: string;
  courseTitle: string;
  sectionCode: string;
  status: SubmissionStatus;
  displayGrade: string;
  sensitivityLabel: string;
  isOverridden: boolean;
  behavioralSignal?: string;
  studentDisplay?: GradeDisplayOutput;
}

export interface GradebookReviewModel {
  visibilityTier: GradebookVisibilityTier;
  metrics: GradebookReviewMetric[];
  records: GradebookReviewRecord[];
  overrideAudit: GradebookAuditRead[];
}
