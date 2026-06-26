import { InstitutionMode, LmsProvider } from "@/modules/academy-config/types";
import { CourseLmsMappingStatus, CourseLmsSyncPolicy } from "@/modules/course-catalog/types";

export type LmsProviderId = Extract<LmsProvider, "none" | "moodle" | "canvas">;

export type LmsCapability =
  | "identity_launch"
  | "single_logout"
  | "course_shell_provisioning"
  | "section_mapping"
  | "roster_sync"
  | "enrollment_sync"
  | "grade_return"
  | "progress_return"
  | "webhooks"
  | "reconciliation";

export type LmsConfigurationStatus = "not_configured" | "configured" | "paused" | "needs_review";

export interface LmsProviderDescriptor {
  id: LmsProviderId;
  displayName: string;
  configurationStatus: LmsConfigurationStatus;
  capabilities: LmsCapability[];
  operationalWarnings: string[];
}

export interface LmsTenantContext {
  tenantId: string;
  institutionMode: InstitutionMode;
  supportedModes: InstitutionMode[];
  providerId: LmsProviderId;
  correlationId: string;
}

export interface LmsActorContext {
  personId: string;
  role: string;
  auditActorId: string;
  studentPersonId?: string;
}

export interface LmsCourseShellRequest {
  tenant: LmsTenantContext;
  actor: LmsActorContext;
  courseId: string;
  sectionId?: string;
  academicYearId: string;
  academicPeriodId: string;
  subdivisionId?: string;
  mappingIntent: CourseLmsMappingStatus;
  syncPolicy: CourseLmsSyncPolicy;
  idempotencyKey: string;
}

export interface LmsRosterSyncRequest {
  tenant: LmsTenantContext;
  actor: LmsActorContext;
  sectionId: string;
  instructorPersonIds: string[];
  studentPersonIds: string[];
  enrollmentStates: Record<string, "active" | "paused" | "withdrawn" | "completed">;
  idempotencyKey: string;
}

export type LmsReviewedImportStatus = "pending_review" | "accepted_for_review" | "rejected" | "superseded";

export interface LmsGradeReturnBatch {
  tenant: LmsTenantContext;
  providerId: LmsProviderId;
  courseId: string;
  sectionId: string;
  results: Array<{
    studentPersonId: string;
    providerResultId: string;
    label: string;
    value: string;
    reviewStatus: LmsReviewedImportStatus;
  }>;
  idempotencyKey: string;
}

export interface LmsProgressReturnBatch {
  tenant: LmsTenantContext;
  providerId: LmsProviderId;
  courseId: string;
  sectionId: string;
  results: Array<{
    studentPersonId: string;
    providerProgressId: string;
    label: string;
    summary: string;
    reviewStatus: LmsReviewedImportStatus;
  }>;
  idempotencyKey: string;
}

export interface LmsLaunchRequest {
  tenant: LmsTenantContext;
  actor: LmsActorContext;
  courseId?: string;
  sectionId?: string;
  targetStudentPersonId?: string;
  redirectPath: string;
  nonce: string;
}

export type LmsLaunchResponse =
  | {
      status: "available";
      displayLabel: string;
      launchUrl: string;
      expiresAt: string;
      auditReference: string;
    }
  | {
      status: "unavailable";
      displayLabel: string;
      unavailableReason: string;
      auditReference: string;
    };

export type LmsWebhookSignatureStatus = "verified" | "failed" | "not_configured";

export interface LmsWebhookEnvelope {
  tenantId: string;
  providerId: LmsProviderId;
  providerEventId: string;
  receivedAt: string;
  signatureStatus: LmsWebhookSignatureStatus;
  normalizedEventType: "course_updated" | "enrollment_updated" | "grade_returned" | "progress_returned" | "unknown";
}

export type LmsOperationStatus = "success" | "unsupported" | "retryable_failure" | "permanent_failure" | "conflict" | "needs_review";

export interface LmsOperationResult {
  status: LmsOperationStatus;
  providerId: LmsProviderId;
  capability: LmsCapability;
  tenantId: string;
  correlationId: string;
  operationId: string;
  retryable: boolean;
  safeMessage: string;
}

export interface LmsAuditEvent {
  tenantId: string;
  providerId: LmsProviderId;
  operation: LmsCapability;
  actorPersonId?: string;
  targetReferences: string[];
  correlationId: string;
  resultStatus: LmsOperationStatus;
  redactedMetadata: Record<string, string | number | boolean>;
}

export type LmsCredentialHealth = "valid" | "invalid" | "unknown";

export interface LmsReconciliationParitySummary {
  expectedCourseShells: number;
  observedCourseShells: number;
  rosterDrift: number;
  gradeReturnDrift: number;
  progressReturnDrift: number;
  capabilityDrift: number;
  credentialHealth: LmsCredentialHealth;
}

export interface LmsReconciliationReport {
  tenantId: string;
  providerId: LmsProviderId;
  correlationId: string;
  parity: LmsReconciliationParitySummary;
  missingMappings: string[];
  staleMappings: string[];
  duplicateProviderObjects: string[];
  rosterDrift: string[];
  enrollmentDrift: string[];
  gradeReturnDrift: string[];
  progressReturnDrift: string[];
  capabilityMismatches: string[];
  requiredActions: string[];
}

const externalProviderCapabilities: LmsCapability[] = [
  "identity_launch",
  "single_logout",
  "course_shell_provisioning",
  "section_mapping",
  "roster_sync",
  "enrollment_sync",
  "grade_return",
  "progress_return",
  "webhooks",
  "reconciliation",
];

export const lmsProviderDescriptors: LmsProviderDescriptor[] = [
  {
    id: "none",
    displayName: "No LMS",
    configurationStatus: "configured",
    capabilities: [],
    operationalWarnings: ["External LMS launch and sync operations are unavailable for this tenant."],
  },
  {
    id: "moodle",
    displayName: "Moodle",
    configurationStatus: "not_configured",
    capabilities: externalProviderCapabilities,
    operationalWarnings: [],
  },
  {
    id: "canvas",
    displayName: "Canvas",
    configurationStatus: "not_configured",
    capabilities: externalProviderCapabilities,
    operationalWarnings: [],
  },
];

export const lmsProviderSecretFieldNames = [
  "accessToken",
  "refreshToken",
  "credentialSecret",
  "clientSecret",
  "sharedSecret",
  "webhookSecret",
  "webhookSignature",
  "providerApiKey",
  "providerPassword",
  "rawProviderPayload",
] as const;

export const lmsSensitiveLaunchFieldNames = [
  "accessToken",
  "refreshToken",
  "credentialSecret",
  "sharedSecret",
  "webhookSignature",
  "rawProviderPayload",
  "providerApiUrl",
] as const;

export const lmsReviewedImportStatuses: LmsReviewedImportStatus[] = [
  "pending_review",
  "accepted_for_review",
  "rejected",
  "superseded",
];

const idempotentCapabilities = new Set<LmsCapability>([
  "course_shell_provisioning",
  "roster_sync",
  "enrollment_sync",
  "grade_return",
  "progress_return",
  "webhooks",
  "reconciliation",
]);

export function providerSupportsLmsCapability(provider: LmsProviderDescriptor, capability: LmsCapability) {
  return provider.capabilities.includes(capability);
}

export function createUnsupportedLmsOperationResult(input: {
  providerId: LmsProviderId;
  capability: LmsCapability;
  tenantId: string;
  correlationId: string;
  operationId: string;
  safeMessage: string;
}): LmsOperationResult {
  return {
    status: "unsupported",
    providerId: input.providerId,
    capability: input.capability,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    operationId: input.operationId,
    retryable: false,
    safeMessage: input.safeMessage,
  };
}

export function validateLmsLaunchResponseSafety(response: Record<string, unknown>) {
  return lmsSensitiveLaunchFieldNames.filter((fieldName) => fieldName in response);
}

export function requiresLmsIdempotencyKey(capability: LmsCapability) {
  return idempotentCapabilities.has(capability);
}

export function buildLmsWebhookDedupeKey(input: { tenantId: string; providerId: LmsProviderId; providerEventId: string }) {
  return `${input.tenantId}:${input.providerId}:${input.providerEventId}`;
}

export function createEmptyLmsReconciliationReport(
  tenantId: string,
  providerId: LmsProviderId,
  correlationId: string,
): LmsReconciliationReport {
  return {
    tenantId,
    providerId,
    correlationId,
    parity: {
      expectedCourseShells: 0,
      observedCourseShells: 0,
      rosterDrift: 0,
      gradeReturnDrift: 0,
      progressReturnDrift: 0,
      capabilityDrift: 0,
      credentialHealth: "unknown",
    },
    missingMappings: [],
    staleMappings: [],
    duplicateProviderObjects: [],
    rosterDrift: [],
    enrollmentDrift: [],
    gradeReturnDrift: [],
    progressReturnDrift: [],
    capabilityMismatches: [],
    requiredActions: [],
  };
}
