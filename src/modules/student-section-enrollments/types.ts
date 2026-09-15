export interface StudentSectionEnrollment {
  id: string;
  tenantId: string;
  studentProfileId: string;
  studentPersonId: string;
  courseSectionId: string;
  programEnrollmentId: string;
  periodRegistrationId: string;
  status: string;
  registeredAt: string;
}

export interface AvailableStudentSection {
  id: string;
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  academicPeriodId: string;
  academicPeriodName: string;
  schedulePattern?: string;
  deliveryMode: string;
  capacity?: number;
  enrolledCount: number;
}

export interface AssignStudentSectionInput {
  studentProfileId: string;
  courseSectionId: string;
}

export interface StudentSectionEnrollmentRepository {
  listAvailableSections(tenantId: string, studentProfileId: string): Promise<AvailableStudentSection[]>;
  assignSection(
    tenantId: string,
    input: Required<AssignStudentSectionInput>,
  ): Promise<StudentSectionEnrollment>;
}
