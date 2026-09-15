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
}

export interface LmsRosterSourceSection {
  id: string;
  tenantId: string;
  courseId: string;
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  academicPeriodId: string;
  academicPeriodName?: string;
  primaryInstructorId?: string;
  registrations: LmsRosterSourceRegistration[];
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
