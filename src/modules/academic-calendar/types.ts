import { CalendarSystem, InstitutionMode, InstitutionProfile, OfficialRecordName, TermStructure } from "@/modules/academy-config/types";

export type WeekStart = "monday" | "sunday";
export type AcademicStatus = "draft" | "active" | "archived";
export type AcademicLifecycleState = "planned" | "enrollment_open" | "active" | "completed" | "archived";
export type AcademicPeriodType = "term" | "session" | "module" | "intensive" | "grading_period" | "reporting_period" | "break";
export type EnrollmentWindowType = "application" | "enrollment" | "registration" | "add_drop" | "withdrawal";
export type GradePostingPolicy = "manual_review" | "auto_post_after_close" | "registrar_posting";
export type SubdivisionType = "campus" | "school" | "department" | "division" | "grade_band" | "cohort";

export interface AcademicCalendarProfile {
  tenantId: string;
  calendarSystem: CalendarSystem;
  defaultTermStructure: TermStructure;
  timezone: string;
  weekStartsOn: WeekStart;
  usesInstructionalDays: boolean;
  usesEnrollmentWindows: boolean;
  usesGradingWindows: boolean;
  usesTranscriptPeriods: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicYear {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  startsOn: string;
  endsOn: string;
  status: AcademicStatus;
  calendarSystem: CalendarSystem;
  subdivisionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicPeriod {
  id: string;
  tenantId: string;
  academicYearId: string;
  parentPeriodId?: string;
  subdivisionId?: string;
  name: string;
  code: string;
  periodType: AcademicPeriodType;
  startsOn: string;
  endsOn: string;
  sequence: number;
  status: AcademicStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentWindow {
  id: string;
  tenantId: string;
  academicPeriodId: string;
  windowType: EnrollmentWindowType;
  opensAt: string;
  closesAt?: string | null;
  appliesToSubdivisionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GradingWindow {
  id: string;
  tenantId: string;
  academicPeriodId: string;
  opensAt: string;
  closesAt: string;
  gradePostingPolicy: GradePostingPolicy;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptPeriod {
  id: string;
  tenantId: string;
  academicPeriodId: string;
  recordType: OfficialRecordName;
  postingOpensAt: string;
  postingClosesAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionSubdivision {
  id: string;
  tenantId: string;
  parentSubdivisionId?: string;
  name: string;
  code: string;
  subdivisionType: SubdivisionType;
  institutionMode?: InstitutionMode;
  status: AcademicStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicCalendarConfiguration {
  institutionProfile: InstitutionProfile;
  calendarProfile: AcademicCalendarProfile;
  academicYears: AcademicYear[];
  periods: AcademicPeriod[];
  enrollmentWindows: EnrollmentWindow[];
  gradingWindows: GradingWindow[];
  transcriptPeriods: TranscriptPeriod[];
  subdivisions: InstitutionSubdivision[];
}
