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

// Document types and application documents (ADR-0048)

export interface DocumentType {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  required: boolean;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentTypeInput {
  tenantId: string;
  name: string;
  slug: string;
  required: boolean;
  description?: string;
}

export type ApplicationDocumentStatus = "pending" | "uploaded" | "received" | "waived";

export interface ApplicationDocument {
  id: string;
  tenantId: string;
  applicationId: string;
  documentTypeId: string;
  status: ApplicationDocumentStatus;
  storagePath?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  receivedAt?: string;
  receivedBy?: string;
  waivedAt?: string;
  waivedBy?: string;
  waiverNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChecklistItem {
  documentTypeId: string;
  documentTypeName: string;
  documentTypeSlug: string;
  required: boolean;
  description?: string;
  document?: ApplicationDocument;
}

export interface UploadUrlRequest {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  storagePath: string;
}

export interface WaiveDocumentInput {
  tenantId: string;
  applicationId: string;
  documentId: string;
  waivedBy: string;
  waiverNote: string;
}

export interface ChecklistCompletionStatus {
  complete: boolean;
  missingDocuments: Array<{
    documentTypeId: string;
    name: string;
  }>;
}
