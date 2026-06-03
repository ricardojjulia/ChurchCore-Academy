import { InstitutionProfile } from "@/modules/academy-config/types";
import { AcademicCalendarConfiguration } from "@/modules/academic-calendar/types";
import { CourseCatalogConfiguration } from "@/modules/course-catalog/types";
import { GradingRecordsConfiguration } from "@/modules/grading-records/types";
import { PeopleConfiguration } from "@/modules/people/types";

export type AcademyProductArea = "academy";

export type EnrollmentStatus = "application_started" | "pending" | "admitted" | "active";
export type DocumentationType =
  | "government_id"
  | "prior_transcript"
  | "application_form"
  | "consent_agreement"
  | "prerequisite_verification";
export type StudentStatusFlag = "good_standing" | "probation" | "pending_review";

export interface AdminUser {
  id: string;
  tenantId: string;
  name: string;
  title: string;
  role: "admissions" | "registrar" | "advisor" | "academic_admin" | "dean";
}

export interface Program {
  id: string;
  tenantId: string;
  name: string;
  credential: "certificate" | "associate" | "bachelor" | "master";
  requiredCredits: number;
  cohortLabel: string;
}

export interface StudentRecord {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  enrollmentStatus: EnrollmentStatus;
  applicationStartedAt?: string;
  admittedAt?: string;
  activeTerm?: string;
  programId?: string;
  advisorUserId?: string;
  missingEnrollmentSteps: string[];
  missingDocuments: DocumentationType[];
  documentationNotes: string[];
  creditsEarned: number;
  expectedCreditsByNow: number;
  transcriptCredits: number;
  gpa?: number;
  statusFlag: StudentStatusFlag;
  allProgramCoursesCompleted: boolean;
  graduationAdministrativeHolds: string[];
  expectedNextTermRegistered: boolean;
  transcriptAlerts: string[];
  recordAlerts: string[];
}

export interface FacultyRecord {
  id: string;
  tenantId: string;
  name: string;
  title: string;
  assignedSectionIds: string[];
  adviseeCount: number;
}

export interface CourseSection {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  programId: string;
  instructorFacultyId?: string;
  rosterCount: number;
  rosterCapacity: number;
  setupAlerts: string[];
}

export interface AcademyThresholds {
  incompleteEnrollmentDays: number;
  graduationCreditThreshold: number;
  creditPaceGap: number;
  minimumGpa: number;
  facultyLoadThreshold: number;
  advisorStudentRatioThreshold: number;
}

export interface AcademyDataset {
  tenantId: string;
  productArea: AcademyProductArea;
  generatedAt: string;
  institutionName: string;
  institutionProfile: InstitutionProfile;
  academicCalendar: AcademicCalendarConfiguration;
  courseCatalog: CourseCatalogConfiguration;
  gradingRecords: GradingRecordsConfiguration;
  peopleConfiguration: PeopleConfiguration;
  administrators: AdminUser[];
  programs: Program[];
  students: StudentRecord[];
  faculty: FacultyRecord[];
  sections: CourseSection[];
  thresholds: AcademyThresholds;
}
