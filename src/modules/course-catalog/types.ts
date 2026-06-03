import { AcademicPeriod, AcademicYear, InstitutionSubdivision } from "@/modules/academic-calendar/types";
import { InstitutionProfile, InstructionalRoleLabel, LmsProvider, OfficialRecordName } from "@/modules/academy-config/types";

export type CourseRecordType = OfficialRecordName | "attendance_only" | "non_record";
export type CourseDurationUnit = "credit_hour" | "clock_hour" | "instructional_day" | "week" | "module" | "semester" | "trimester" | "quarter" | "custom";
export type CourseType =
  | "bible_course"
  | "general_education"
  | "major_requirement"
  | "elective"
  | "seminary_course"
  | "ministry_practicum"
  | "internship"
  | "lab"
  | "children_class"
  | "homeroom"
  | "chapel"
  | "custom";
export type CourseLevel = "children" | "certificate" | "undergraduate" | "graduate" | "continuing_education" | "mixed";
export type CourseStatus = "draft" | "active" | "archived";
export type DeliveryMode = "in_person" | "online" | "hybrid" | "independent_study" | "field_practicum" | "chapel" | "custom";
export type CourseSectionStatus = "draft" | "scheduled" | "open" | "in_progress" | "completed" | "cancelled" | "archived";
export type PrerequisiteRequirementType = "required_before_registration" | "required_before_completion" | "recommended" | "corequisite" | "placement_required";
export type CourseLmsProvider = Exclude<LmsProvider, "unconfigured"> | "external";
export type CourseLmsMappingStatus = "not_required" | "planned" | "ready_to_provision" | "mapped" | "needs_review" | "disabled";
export type CourseLmsSyncPolicy = "manual" | "provision_shell_only" | "roster_sync" | "grade_return" | "full_section_sync";

export interface CourseCatalogProfile {
  tenantId: string;
  defaultCourseRecordType: CourseRecordType;
  defaultDurationUnit: CourseDurationUnit;
  supportsCredits: boolean;
  supportsClockHours: boolean;
  supportsCompetencies: boolean;
  supportsNarrativeEvaluation: boolean;
  supportsGradeLevels: boolean;
  supportsLmsMapping: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDuration {
  durationUnit: CourseDurationUnit;
  durationValue: number;
  instructionalMinutes?: number;
  creditHours?: number;
  clockHours?: number;
  competencyCount?: number;
}

export interface Course {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  description: string;
  courseType: CourseType;
  courseLevel: CourseLevel;
  recordType: CourseRecordType;
  defaultDuration: CourseDuration;
  defaultCredits?: number;
  defaultClockHours?: number;
  defaultCompetencySetId?: string;
  owningSubdivisionId?: string;
  gradeBandSubdivisionId?: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CourseSection {
  id: string;
  tenantId: string;
  courseId: string;
  academicYearId: string;
  academicPeriodId: string;
  subdivisionId?: string;
  sectionCode: string;
  titleOverride?: string;
  deliveryMode: DeliveryMode;
  schedulePattern?: string;
  capacity?: number;
  status: CourseSectionStatus;
  primaryInstructorRole: InstructionalRoleLabel;
  primaryInstructorId?: string;
  assistantInstructorIds: string[];
  lmsMappingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoursePrerequisite {
  id: string;
  tenantId: string;
  courseId: string;
  requiredCourseId: string;
  requirementType: PrerequisiteRequirementType;
  minimumGradeRuleId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseLmsMapping {
  id: string;
  tenantId: string;
  courseId?: string;
  sectionId?: string;
  provider: CourseLmsProvider;
  mappingStatus: CourseLmsMappingStatus;
  externalCourseKey?: string;
  externalSectionKey?: string;
  syncPolicy: CourseLmsSyncPolicy;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseCatalogConfiguration {
  institutionProfile: InstitutionProfile;
  catalogProfile: CourseCatalogProfile;
  academicYears: AcademicYear[];
  academicPeriods: AcademicPeriod[];
  subdivisions: InstitutionSubdivision[];
  courses: Course[];
  sections: CourseSection[];
  prerequisites: CoursePrerequisite[];
  lmsMappings: CourseLmsMapping[];
}
