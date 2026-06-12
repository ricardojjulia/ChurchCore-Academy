import {
  LmsAuditEvent,
  LmsCourseShellRequest,
  LmsOperationResult,
  LmsRosterSyncRequest,
  createUnsupportedLmsOperationResult,
} from "./contract";
import { createLmsAuditEvent } from "./sync-audit-reconciliation";
import { ResolvedTenantLmsProvider } from "./tenant-provider-selection";

export interface CanvasSyncConfiguration {
  tenantId: string;
  accountId?: string;
  defaultInstructorRole: "teacher" | "ta";
  defaultStudentRole: "student";
  accessToken?: string;
  refreshToken?: string;
  clientSecret?: string;
  sharedSecret?: string;
  webhookSecret?: string;
  rawProviderPayload?: unknown;
}

export interface CanvasCourseShellOperation {
  type: "upsert_course_shell";
  idempotencyKey: string;
  stableCourseKey: string;
  stableSectionKey?: string;
  academicYearId: string;
  academicPeriodId: string;
  subdivisionId?: string;
  mappingIntent: LmsCourseShellRequest["mappingIntent"];
  syncPolicy: LmsCourseShellRequest["syncPolicy"];
  accountId?: string;
}

export interface CanvasRosterMembership {
  personId: string;
  role: "teacher" | "ta" | "student";
  enrollmentState: "active" | "paused" | "withdrawn" | "completed";
}

export interface CanvasRosterSyncOperation {
  type: "sync_roster_membership";
  idempotencyKey: string;
  stableSectionKey: string;
  memberships: CanvasRosterMembership[];
}

export interface CanvasSyncPlan<TOperation> {
  result: LmsOperationResult;
  auditEvent: LmsAuditEvent;
  providerOperations: TOperation[];
}

export interface CreateCanvasCourseShellProvisioningPlanInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: CanvasSyncConfiguration;
  request: LmsCourseShellRequest;
}

export interface CreateCanvasRosterSyncPlanInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: CanvasSyncConfiguration;
  request: LmsRosterSyncRequest;
}

function assertTenantMatch(input: {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: CanvasSyncConfiguration;
  requestTenantId: string;
}) {
  const expectedTenantId = input.resolvedProvider.tenant.tenantId;

  if (input.configuration.tenantId !== expectedTenantId || input.requestTenantId !== expectedTenantId) {
    throw new Error("Cannot create Canvas sync plan across tenants.");
  }
}

function assertIdempotencyKey(idempotencyKey: string) {
  if (!idempotencyKey.trim()) {
    throw new Error("Canvas sync requires an idempotency key.");
  }
}

function stableKey(tenantId: string, id: string) {
  return `${tenantId}:${id}`;
}

function successResult(input: {
  tenantId: string;
  correlationId: string;
  capability: "course_shell_provisioning" | "roster_sync";
  operationId: string;
  safeMessage: string;
}): LmsOperationResult {
  return {
    status: "success",
    providerId: "canvas",
    capability: input.capability,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    operationId: input.operationId,
    retryable: false,
    safeMessage: input.safeMessage,
  };
}

function gatedResult(
  resolvedProvider: ResolvedTenantLmsProvider,
  capability: "course_shell_provisioning" | "roster_sync",
  operationId: string,
) {
  return createUnsupportedLmsOperationResult({
    providerId: "canvas",
    capability,
    tenantId: resolvedProvider.tenant.tenantId,
    correlationId: resolvedProvider.tenant.correlationId,
    operationId,
    safeMessage: resolvedProvider.warnings[0] ?? "Canvas sync is not active for this tenant.",
  });
}

function emptyAuditEvent(input: {
  tenantId: string;
  capability: "course_shell_provisioning" | "roster_sync";
  actorPersonId?: string;
  targetReferences: string[];
  correlationId: string;
  operationId: string;
  safeMessage: string;
}) {
  return createLmsAuditEvent({
    tenantId: input.tenantId,
    providerId: "canvas",
    operation: input.capability,
    actorPersonId: input.actorPersonId,
    targetReferences: input.targetReferences,
    correlationId: input.correlationId,
    resultStatus: "unsupported",
    metadata: {
      operationId: input.operationId,
      safeMessage: input.safeMessage,
    },
  });
}

export function createCanvasCourseShellProvisioningPlan(
  input: CreateCanvasCourseShellProvisioningPlanInput,
): CanvasSyncPlan<CanvasCourseShellOperation> {
  assertTenantMatch({
    resolvedProvider: input.resolvedProvider,
    configuration: input.configuration,
    requestTenantId: input.request.tenant.tenantId,
  });
  assertIdempotencyKey(input.request.idempotencyKey);

  const tenantId = input.request.tenant.tenantId;
  const targetReferences = [input.request.courseId, input.request.sectionId].filter((value): value is string => Boolean(value));

  if (!input.resolvedProvider.supports("course_shell_provisioning")) {
    const result = gatedResult(input.resolvedProvider, "course_shell_provisioning", input.request.idempotencyKey);

    return {
      result,
      auditEvent: emptyAuditEvent({
        tenantId,
        capability: "course_shell_provisioning",
        actorPersonId: input.request.actor.personId,
        targetReferences,
        correlationId: input.request.tenant.correlationId,
        operationId: input.request.idempotencyKey,
        safeMessage: result.safeMessage,
      }),
      providerOperations: [],
    };
  }

  const result = successResult({
    tenantId,
    correlationId: input.request.tenant.correlationId,
    capability: "course_shell_provisioning",
    operationId: input.request.idempotencyKey,
    safeMessage: "Canvas course shell provisioning plan is ready.",
  });

  return {
    result,
    auditEvent: createLmsAuditEvent({
      tenantId,
      providerId: "canvas",
      operation: "course_shell_provisioning",
      actorPersonId: input.request.actor.personId,
      targetReferences,
      correlationId: input.request.tenant.correlationId,
      resultStatus: "success",
      metadata: {
        mappingIntent: input.request.mappingIntent,
        syncPolicy: input.request.syncPolicy,
        hasSection: Boolean(input.request.sectionId),
      },
    }),
    providerOperations: [
      {
        type: "upsert_course_shell",
        idempotencyKey: input.request.idempotencyKey,
        stableCourseKey: stableKey(tenantId, input.request.courseId),
        stableSectionKey: input.request.sectionId ? stableKey(tenantId, input.request.sectionId) : undefined,
        academicYearId: input.request.academicYearId,
        academicPeriodId: input.request.academicPeriodId,
        subdivisionId: input.request.subdivisionId,
        mappingIntent: input.request.mappingIntent,
        syncPolicy: input.request.syncPolicy,
        accountId: input.configuration.accountId,
      },
    ],
  };
}

function rosterMemberships(configuration: CanvasSyncConfiguration, request: LmsRosterSyncRequest): CanvasRosterMembership[] {
  return [
    ...request.instructorPersonIds.map((personId) => ({
      personId,
      role: configuration.defaultInstructorRole,
      enrollmentState: "active" as const,
    })),
    ...request.studentPersonIds.map((personId) => ({
      personId,
      role: configuration.defaultStudentRole,
      enrollmentState: request.enrollmentStates[personId] ?? "active",
    })),
  ];
}

export function createCanvasRosterSyncPlan(input: CreateCanvasRosterSyncPlanInput): CanvasSyncPlan<CanvasRosterSyncOperation> {
  assertTenantMatch({
    resolvedProvider: input.resolvedProvider,
    configuration: input.configuration,
    requestTenantId: input.request.tenant.tenantId,
  });
  assertIdempotencyKey(input.request.idempotencyKey);

  const tenantId = input.request.tenant.tenantId;
  const targetReferences = [input.request.sectionId, ...input.request.instructorPersonIds, ...input.request.studentPersonIds];

  if (!input.resolvedProvider.supports("roster_sync")) {
    const result = gatedResult(input.resolvedProvider, "roster_sync", input.request.idempotencyKey);

    return {
      result,
      auditEvent: emptyAuditEvent({
        tenantId,
        capability: "roster_sync",
        actorPersonId: input.request.actor.personId,
        targetReferences,
        correlationId: input.request.tenant.correlationId,
        operationId: input.request.idempotencyKey,
        safeMessage: result.safeMessage,
      }),
      providerOperations: [],
    };
  }

  const memberships = rosterMemberships(input.configuration, input.request);
  const activeEnrollmentCount = memberships.filter((membership) => membership.enrollmentState === "active").length;
  const result = successResult({
    tenantId,
    correlationId: input.request.tenant.correlationId,
    capability: "roster_sync",
    operationId: input.request.idempotencyKey,
    safeMessage: "Canvas roster sync plan is ready.",
  });

  return {
    result,
    auditEvent: createLmsAuditEvent({
      tenantId,
      providerId: "canvas",
      operation: "roster_sync",
      actorPersonId: input.request.actor.personId,
      targetReferences,
      correlationId: input.request.tenant.correlationId,
      resultStatus: "success",
      metadata: {
        instructorCount: input.request.instructorPersonIds.length,
        studentCount: input.request.studentPersonIds.length,
        activeEnrollmentCount,
      },
    }),
    providerOperations: [
      {
        type: "sync_roster_membership",
        idempotencyKey: input.request.idempotencyKey,
        stableSectionKey: stableKey(tenantId, input.request.sectionId),
        memberships,
      },
    ],
  };
}
