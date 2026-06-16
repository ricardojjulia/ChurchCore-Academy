export type SensitivityTier = "standard" | "elevated" | "pastoral";

export type AcademicStanding =
  | "good_standing"
  | "academic_warning"
  | "academic_probation"
  | "honors"
  | "incomplete";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "graded"
  | "returned"
  | "resubmitted";

export type AssignmentType =
  | "essay"
  | "quiz"
  | "project"
  | "participation"
  | "attendance"
  | "practical"
  | "reflection";

export type OverrideType = "assignment_grade" | "final_grade";

export type GradebookVisibilityTier = "student" | "instructor" | "admin";

export interface GradeDisplayInput {
  assignmentTitle: string;
  percentage: number | null;
  letterGrade: string | null;
  isPassing: boolean | null;
  instructorFeedback: string | null;
  sensitivityTier: SensitivityTier;
}

export interface GradeDisplayOutput {
  assignmentTitle: string;
  displayPercentage: string;
  primaryLabel: string;
  contextStatement: string;
  feedbackDisplay: string | null;
  showRawScore: false;
}

export interface GradeRecord {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  learnerPersonId: string;
  pointsEarned: number | null;
  maxPoints: number;
  percentage: number | null;
  letterGrade: string | null;
  isPassing: boolean | null;
  instructorFeedback: string | null;
  sensitivityTier: SensitivityTier;
  gradedAt: string;
  isOverridden: boolean;
}

export interface LearnerGradeView {
  learnerPersonId: string;
  courseId: string;
  courseTitle: string;
  finalPercentage: number | null;
  finalLetterGrade: string | null;
  academicStanding: AcademicStanding | null;
  sensitivityTier: SensitivityTier;
  records: GradeRecord[];
}

export interface InstructorGradeRow extends GradeRecord {
  learnerDisplayName: string;
  submissionId: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  behavioralSignal?: string | null;
}
