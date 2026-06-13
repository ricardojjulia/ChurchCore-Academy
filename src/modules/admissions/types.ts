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
