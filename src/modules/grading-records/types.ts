import { InstitutionMode, InstitutionProfile } from "@/modules/academy-config/types";

export type EvaluationType =
  | "letter_grade"
  | "numeric_percentage"
  | "pass_fail"
  | "completion"
  | "competency"
  | "narrative"
  | "attendance_only"
  | "custom";
export type OfficialRecordType =
  | "transcript"
  | "progress_record"
  | "completion_record"
  | "report_card"
  | "competency_record"
  | "attendance_record"
  | "graduation_audit"
  | "custom";
export type GradingStatus = "draft" | "active" | "inactive" | "archived";
export type GradeReleasePolicy = "registrar_release" | "teacher_releases_after_review" | "immediate_after_posting" | "manual_hold";
export type GuardianVisibilityPolicy = "not_applicable" | "guardian_relationship_required" | "released_records_only" | "disabled";
export type GpaPolicy = "included" | "excluded" | "not_applicable";
export type CreditPolicy = "attempted_and_earned" | "attempted_only" | "earned_only" | "not_applicable";
export type ClockHourPolicy = "attempted_and_earned" | "attendance_threshold" | "not_applicable";
export type CompetencyPolicy = "not_applicable" | "checklist" | "progress_summary" | "mastery_required";
export type NarrativePolicy = "required" | "optional" | "not_required";
export type PostingPolicy = "registrar_posting" | "teacher_submit_registrar_release" | "academic_admin_posting";
export type LmsGradeReturnPolicy = "manual_entry_only" | "review_before_posting" | "disabled" | "direct_post_to_official_record";
export type PostingAuthority = "registrar" | "academic_admin" | "dean" | "institution_admin";
export type StandingType =
  | "good_standing"
  | "warning"
  | "probation"
  | "retention_review"
  | "promotion_ready"
  | "graduation_ready"
  | "graduation_blocked";

export interface GradingProfile {
  tenantId: string;
  defaultEvaluationType: EvaluationType;
  defaultOfficialRecordType: OfficialRecordType;
  supportsGpa: boolean;
  supportsCredits: boolean;
  supportsClockHours: boolean;
  supportsCompetencies: boolean;
  supportsNarrativeEvaluation: boolean;
  supportsPromotion: boolean;
  supportsGraduationAudit: boolean;
  gradeReleasePolicy: GradeReleasePolicy;
  guardianVisibilityPolicy: GuardianVisibilityPolicy;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationScale {
  id: string;
  tenantId: string;
  name: string;
  scaleType: EvaluationType;
  appliesToRecordType: OfficialRecordType;
  narrativeRequired?: boolean;
  status: GradingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationScaleBand {
  id: string;
  tenantId: string;
  scaleId: string;
  label: string;
  minimumValue?: number;
  maximumValue?: number;
  gradePoints?: number;
  isPassing: boolean;
  isCompletion: boolean;
  officialRecordValue: string;
  sequence: number;
}

export interface EvaluationRuleSet {
  id: string;
  tenantId: string;
  courseId: string;
  sectionId?: string;
  evaluationType: EvaluationType;
  scaleId: string;
  recordType: OfficialRecordType;
  gpaPolicy: GpaPolicy;
  creditPolicy: CreditPolicy;
  clockHourPolicy: ClockHourPolicy;
  competencyPolicy: CompetencyPolicy;
  narrativePolicy: NarrativePolicy;
  postingPolicy: PostingPolicy;
  lmsGradeReturnPolicy: LmsGradeReturnPolicy;
  status: GradingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OfficialRecordRule {
  id: string;
  tenantId: string;
  recordType: OfficialRecordType;
  appliesToInstitutionMode: InstitutionMode;
  postingAuthority: PostingAuthority;
  releasePolicy: GradeReleasePolicy | "guardian_release_after_review";
  includedInTranscript: boolean;
  includedInProgressReport: boolean;
  includedInCompletionRecord: boolean;
  includedInPromotion: boolean;
  includedInGraduationAudit: boolean;
  status: GradingStatus;
}

export interface AcademicStandingRule {
  id: string;
  tenantId: string;
  name: string;
  standingType: StandingType;
  appliesToInstitutionMode: InstitutionMode;
  minimumGpa?: number;
  minimumCreditsEarned?: number;
  minimumClockHours?: number;
  requiredCompetencies?: string[];
  requiredCompletionRecords?: string[];
  promotionCriteria?: string;
  graduationCriteria?: string;
  status: GradingStatus;
}

export interface GradingRecordsConfiguration {
  institutionProfile: InstitutionProfile;
  gradingProfile: GradingProfile;
  scales: EvaluationScale[];
  scaleBands: EvaluationScaleBand[];
  ruleSets: EvaluationRuleSet[];
  officialRecordRules: OfficialRecordRule[];
  standingRules: AcademicStandingRule[];
}
