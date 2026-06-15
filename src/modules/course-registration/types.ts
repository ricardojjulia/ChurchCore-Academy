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
  createRegistration(
    input: CourseRegistrationRequest,
    admission: Required<Pick<ConvertedAdmissionRecord, "studentProfileId" | "programEnrollmentId" | "periodRegistrationId" | "studentPersonId">>,
  ): Promise<CourseRegistrationResult>;
}
