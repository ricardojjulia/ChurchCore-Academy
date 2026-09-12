import type { LmsRosterSyncRequest } from "@/modules/lms-contract/contract";

export type AcademySectionRegistrationStatus =
  | "pending_confirmation"
  | "registered"
  | "waitlisted"
  | "withdrawn"
  | "completed";

export interface LmsRosterSourceRegistration {
  studentPersonId: string;
  status: AcademySectionRegistrationStatus | string;
  registeredOn?: string;
}

export interface LmsRosterSourcePerson {
  id: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  phone?: string;
  status: string;
}

export interface LmsRosterSourceSection {
  id: string;
  tenantId: string;
  institutionName?: string;
  courseId: string;
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  sectionTitle?: string;
  academicPeriodId: string;
  academicPeriodName?: string;
  academicPeriodType?: string;
  academicPeriodStartsOn?: string;
  academicPeriodEndsOn?: string;
  academicYearCode?: string;
  primaryInstructorId?: string;
  registrations: LmsRosterSourceRegistration[];
  people?: LmsRosterSourcePerson[];
}

export interface LmsRosterEligibleSection {
  id: string;
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  academicPeriodName: string;
  enrolledCount: number;
}

export type LmsRosterPlanInput = Pick<
  LmsRosterSyncRequest,
  "sectionId" | "instructorPersonIds" | "studentPersonIds" | "enrollmentStates" | "idempotencyKey"
>;

export interface LmsRosterSourceRepository {
  listRosterEligibleSections(tenantId: string): Promise<LmsRosterEligibleSection[]>;
  fetchSectionRosterSource(tenantId: string, sectionId: string): Promise<LmsRosterSourceSection>;
}
