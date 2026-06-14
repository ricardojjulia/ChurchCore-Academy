export type AdmissionApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "accepted"
  | "declined"
  | "withdrawn";

export interface AdmissionApplication {
  id: string;
  tenantId: string;
  applicantPersonId: string;
  programId: string;
  applicationTermId?: string;
  legalName: string;
  preferredName?: string;
  email: string;
  phone?: string;
  status: AdmissionApplicationStatus;
  submittedAt?: string;
  decidedAt?: string;
  decidedByPersonId?: string;
  decisionReason?: string;
  convertedAt?: string;
  convertedByPersonId?: string;
  studentProfileId?: string;
  programEnrollmentId?: string;
  periodRegistrationId?: string;
  studentNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdmissionApplicationInput {
  tenantId: string;
  applicantPersonId: string;
  programId: string;
  applicationTermId?: string;
  legalName: string;
  preferredName?: string;
  email: string;
  phone?: string;
}

export type AdmissionApplicationEventType =
  | "created"
  | "submitted"
  | "review_started"
  | "accepted"
  | "declined"
  | "withdrawn";

export interface AdmissionApplicationEventInput {
  tenantId: string;
  applicationId: string;
  actorPersonId: string;
  eventType: AdmissionApplicationEventType;
  previousStatus?: AdmissionApplicationStatus;
  nextStatus: AdmissionApplicationStatus;
  redactedNotes?: string;
  correlationId?: string;
  idempotencyKey: string;
}

export interface AdmissionApplicationListFilters {
  status?: AdmissionApplicationStatus;
  applicantPersonId?: string;
}
