import {
  LmsAuditEvent,
  LmsCapability,
  LmsOperationStatus,
  LmsProviderId,
  LmsReconciliationReport,
  LmsWebhookEnvelope,
  buildLmsWebhookDedupeKey,
  lmsProviderSecretFieldNames,
} from "./contract";

type LmsAuditMetadata = Record<string, unknown>;

export interface CreateLmsAuditEventInput {
  tenantId: string;
  providerId: LmsProviderId;
  operation: LmsCapability;
  actorPersonId?: string;
  targetReferences: string[];
  correlationId: string;
  resultStatus: LmsOperationStatus;
  metadata: LmsAuditMetadata;
}

export interface LmsOperationIdempotencyKeyInput {
  tenantId: string;
  providerId: LmsProviderId;
  capability: LmsCapability;
  operationId: string;
}

export interface LmsReconciliationSummary {
  tenantId: string;
  providerId: LmsProviderId;
  correlationId: string;
  status: "clean" | "needs_action";
  driftCount: number;
  requiredActionCount: number;
}

const sensitiveMetadataFields = new Set<string>(lmsProviderSecretFieldNames);

function isPrimitiveMetadata(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function redactAuditMetadata(metadata: LmsAuditMetadata): LmsAuditEvent["redactedMetadata"] {
  const redactedMetadata: LmsAuditEvent["redactedMetadata"] = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!sensitiveMetadataFields.has(key) && isPrimitiveMetadata(value)) {
      redactedMetadata[key] = value;
    }
  }

  return redactedMetadata;
}

function assertTargetReferencesAreTenantScoped(tenantId: string, targetReferences: string[]) {
  const crossTenantReference = targetReferences.find((reference) => reference.includes(":") && !reference.startsWith(`${tenantId}:`));

  if (crossTenantReference) {
    throw new Error("Cross-tenant LMS audit target reference denied.");
  }
}

export function createLmsAuditEvent(input: CreateLmsAuditEventInput): LmsAuditEvent {
  assertTargetReferencesAreTenantScoped(input.tenantId, input.targetReferences);

  return {
    tenantId: input.tenantId,
    providerId: input.providerId,
    operation: input.operation,
    actorPersonId: input.actorPersonId,
    targetReferences: input.targetReferences,
    correlationId: input.correlationId,
    resultStatus: input.resultStatus,
    redactedMetadata: redactAuditMetadata(input.metadata),
  };
}

export function buildLmsOperationIdempotencyKey(input: LmsOperationIdempotencyKeyInput) {
  return `${input.tenantId}:${input.providerId}:${input.capability}:${input.operationId}`;
}

export function isDuplicateLmsWebhookEvent(envelope: LmsWebhookEnvelope, seenDedupeKeys: ReadonlySet<string>) {
  return seenDedupeKeys.has(
    buildLmsWebhookDedupeKey({
      tenantId: envelope.tenantId,
      providerId: envelope.providerId,
      providerEventId: envelope.providerEventId,
    }),
  );
}

export function summarizeLmsReconciliationReport(report: LmsReconciliationReport): LmsReconciliationSummary {
  const driftCount =
    report.missingMappings.length +
    report.staleMappings.length +
    report.duplicateProviderObjects.length +
    report.rosterDrift.length +
    report.enrollmentDrift.length +
    report.gradeReturnDrift.length +
    report.progressReturnDrift.length +
    report.capabilityMismatches.length;

  return {
    tenantId: report.tenantId,
    providerId: report.providerId,
    correlationId: report.correlationId,
    status: driftCount > 0 || report.requiredActions.length > 0 ? "needs_action" : "clean",
    driftCount,
    requiredActionCount: report.requiredActions.length,
  };
}
