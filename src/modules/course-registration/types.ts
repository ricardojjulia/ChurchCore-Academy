export interface CourseRegistrationRequest {
  tenantId: string;
  applicationId: string;
  courseSectionId: string;
  actorPersonId: string;
  idempotencyKey: string;
  correlationId: string;
  confirmedAt: string;
  confirmationNote?: string;
}

export interface CourseRegistrationResult {
  registrationId: string;
  applicationId: string;
  studentProfileId: string;
  studentPersonId: string;
  courseSectionId: string;
  programEnrollmentId: string;
  periodRegistrationId: string;
  registeredAt: string;
  confirmedAt: string;
  idempotencyKey: string;
}

export interface CourseSectionRegistrationEligibility {
  courseSectionId: string;
  academicPeriodId: string;
  status: string;
  capacity: number | null;
  activeRegistrationCount: number;
  hasActiveRegistrationForStudent: boolean;
  registrationWindowOpen: boolean;
  unmetPrerequisites: string[];
  activeHolds: string[];
}

export interface ConvertedAdmissionRecord {
  tenantId: string;
  applicationId: string;
  status: "accepted" | "declined" | "under_review" | "submitted" | "draft" | "withdrawn";
  studentProfileId?: string;
  programEnrollmentId?: string;
  periodRegistrationId?: string;
  studentPersonId?: string;
}

export interface CourseRegistrationRepository {
  findConvertedAdmission(
    tenantId: string,
    applicationId: string,
  ): Promise<ConvertedAdmissionRecord | undefined>;
  findReplay(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<CourseRegistrationResult | undefined>;
  evaluateSectionEligibility(input: {
    tenantId: string;
    courseSectionId: string;
    studentPersonId: string;
    periodRegistrationId: string;
    evaluatedAt: string;
  }): Promise<CourseSectionRegistrationEligibility>;
  createRegistration(
    input: CourseRegistrationRequest,
    admission: Required<Pick<ConvertedAdmissionRecord, "studentProfileId" | "programEnrollmentId" | "periodRegistrationId" | "studentPersonId">>,
  ): Promise<CourseRegistrationResult>;
}
