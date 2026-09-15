import type { AcademyRole } from "@/modules/academy-auth/policy";

export type CommunicationTemplateKey =
  | "admissions_decision"
  | "registration_confirmation"
  | "transcript_update"
  | "billing_account_update"
  | "grade_release"
  | "attendance_concern"
  | "workflow_assignment"
  | "application_received"
  | "award_letter_ready";

export type CommunicationChannel = "in_app" | "email";
export type CommunicationStatus = "queued" | "sent" | "failed" | "read" | "cancelled";
export type CommunicationSourceType =
  | "admissions"
  | "registration"
  | "transcript"
  | "billing"
  | "gradebook"
  | "attendance"
  | "workflow"
  | "manual";

export interface CommunicationPerson {
  id: string;
  displayName: string;
  email?: string;
  roles: AcademyRole[];
}

export interface CommunicationRelationship {
  studentPersonId: string;
  relatedPersonId: string;
  relationshipType: string;
  visibility: string;
  status: string;
}

export interface CommunicationDirectory {
  people: CommunicationPerson[];
  relationships: CommunicationRelationship[];
  emailOptOutPersonIds: string[];
}

export type CommunicationAudience =
  | { type: "student"; personId: string }
  | { type: "guardian"; studentPersonId: string }
  | { type: "staff_role"; roles: AcademyRole[] };

export interface CommunicationRecipient {
  personId: string;
  displayName: string;
  email?: string;
  relatedStudentPersonId?: string;
}

export interface RenderedCommunicationTemplate {
  subject: string;
  body: string;
}

export interface CreateCommunicationInput {
  templateKey: CommunicationTemplateKey;
  audience: CommunicationAudience;
  channels: CommunicationChannel[];
  variables: Record<string, string | number | boolean | null | undefined>;
  sourceType: CommunicationSourceType;
  sourceId: string;
  idempotencyKey: string;
  essential: boolean;
  sendAt?: string;
}

export interface CommunicationMessage {
  id: string;
  tenantId: string;
  recipientPersonId: string;
  recipientDisplayName: string;
  recipientEmail?: string;
  relatedStudentPersonId?: string;
  channel: CommunicationChannel;
  templateKey: CommunicationTemplateKey;
  subject: string;
  body: string;
  status: CommunicationStatus;
  sourceType: CommunicationSourceType;
  sourceId: string;
  idempotencyKey: string;
  retryCount: number;
  providerReference?: string;
  failureReason?: string;
  sendAt?: string;
  createdAt: string;
  sentAt?: string;
  readAt?: string;
}

export interface ProviderFailureInput {
  messageId: string;
  reason: string;
  rawProviderPayload?: unknown;
}

export interface CommunicationsRepository {
  loadDirectory(tenantId: string): Promise<CommunicationDirectory>;
  findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<CommunicationMessage[]>;
  enqueueMessages(messages: CommunicationMessage[], auditEvents: string[]): Promise<CommunicationMessage[]>;
  listMessages(tenantId: string, recipientPersonId?: string): Promise<CommunicationMessage[]>;
  markRead(tenantId: string, messageId: string, recipientPersonId: string): Promise<CommunicationMessage>;
  markProviderFailure(tenantId: string, messageId: string, reason: string): Promise<CommunicationMessage>;
}
