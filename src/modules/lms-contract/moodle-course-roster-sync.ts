import {
  LmsAuditEvent,
  LmsCourseShellRequest,
  LmsOperationResult,
  LmsRosterSyncRequest,
  createUnsupportedLmsOperationResult,
} from "./contract";
import { createLmsAuditEvent } from "./sync-audit-reconciliation";
import { ResolvedTenantLmsProvider } from "./tenant-provider-selection";
import { MoodleHttpClient, LmsProviderError } from "./moodle-http-client";
import { CircuitBreakerDb, getCircuitState, recordFailure, recordSuccess } from "./circuit-breaker";

export interface MoodleSyncConfiguration {
  tenantId: string;
  courseCategoryId?: string;
  defaultInstructorRole: "editingteacher" | "teacher";
  defaultStudentRole: "student";
  accessToken?: string;
  refreshToken?: string;
  clientSecret?: string;
  sharedSecret?: string;
  webhookSecret?: string;
  rawProviderPayload?: unknown;
}

export interface MoodleCourseShellOperation {
  type: "upsert_course_shell";
  idempotencyKey: string;
  stableCourseKey: string;
  stableSectionKey?: string;
  academicYearId: string;
  academicPeriodId: string;
  subdivisionId?: string;
  mappingIntent: LmsCourseShellRequest["mappingIntent"];
  syncPolicy: LmsCourseShellRequest["syncPolicy"];
  categoryId?: string;
}

export interface MoodleRosterMembership {
  personId: string;
  role: "editingteacher" | "teacher" | "student";
  enrollmentState: "active" | "paused" | "withdrawn" | "completed";
}

export interface MoodleRosterSyncOperation {
  type: "sync_roster_membership";
  idempotencyKey: string;
  stableSectionKey: string;
  memberships: MoodleRosterMembership[];
}

export interface MoodleSyncPlan<TOperation> {
  result: LmsOperationResult;
  auditEvent: LmsAuditEvent;
  providerOperations: TOperation[];
}

export interface CreateMoodleCourseShellProvisioningPlanInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: MoodleSyncConfiguration;
  request: LmsCourseShellRequest;
}

export interface CreateMoodleRosterSyncPlanInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: MoodleSyncConfiguration;
  request: LmsRosterSyncRequest;
}

function assertTenantMatch(input: {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: MoodleSyncConfiguration;
  requestTenantId: string;
}) {
  const expectedTenantId = input.resolvedProvider.tenant.tenantId;

  if (input.configuration.tenantId !== expectedTenantId || input.requestTenantId !== expectedTenantId) {
    throw new Error("Cannot create Moodle sync plan across tenants.");
  }
}

function assertIdempotencyKey(idempotencyKey: string) {
  if (!idempotencyKey.trim()) {
    throw new Error("Moodle sync requires an idempotency key.");
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
    providerId: "moodle",
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
    providerId: "moodle",
    capability,
    tenantId: resolvedProvider.tenant.tenantId,
    correlationId: resolvedProvider.tenant.correlationId,
    operationId,
    safeMessage: resolvedProvider.warnings[0] ?? "Moodle sync is not active for this tenant.",
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
    providerId: "moodle",
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

export function createMoodleCourseShellProvisioningPlan(
  input: CreateMoodleCourseShellProvisioningPlanInput,
): MoodleSyncPlan<MoodleCourseShellOperation> {
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
    safeMessage: "Moodle course shell provisioning plan is ready.",
  });

  return {
    result,
    auditEvent: createLmsAuditEvent({
      tenantId,
      providerId: "moodle",
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
        categoryId: input.configuration.courseCategoryId,
      },
    ],
  };
}

function rosterMemberships(configuration: MoodleSyncConfiguration, request: LmsRosterSyncRequest): MoodleRosterMembership[] {
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

export function createMoodleRosterSyncPlan(input: CreateMoodleRosterSyncPlanInput): MoodleSyncPlan<MoodleRosterSyncOperation> {
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
    safeMessage: "Moodle roster sync plan is ready.",
  });

  return {
    result,
    auditEvent: createLmsAuditEvent({
      tenantId,
      providerId: "moodle",
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

export interface ExecuteMoodleRosterSyncInput {
  plan: MoodleSyncPlan<MoodleRosterSyncOperation>;
  httpClient: MoodleHttpClient;
  db: CircuitBreakerDb;
  moodleCourseId: number;
  personIdToMoodleUserId: Map<string, number>;
}

export async function executeMoodleRosterSync(
  input: ExecuteMoodleRosterSyncInput,
): Promise<{ result: LmsOperationResult; auditEvent: LmsAuditEvent }> {
  const { plan, httpClient, db, moodleCourseId, personIdToMoodleUserId } = input;
  const tenantId = plan.result.tenantId;

  const circuitState = await getCircuitState(tenantId, "moodle", db);
  if (circuitState === "open") {
    return {
      result: {
        ...plan.result,
        status: "retryable_failure",
        safeMessage: "Moodle integration circuit breaker is open",
      },
      auditEvent: createLmsAuditEvent({
        ...plan.auditEvent,
        resultStatus: "retryable_failure",
        metadata: {
          ...plan.auditEvent.redactedMetadata,
          circuitState: "open",
        },
      }),
    };
  }

  if (plan.providerOperations.length === 0) {
    return {
      result: plan.result,
      auditEvent: plan.auditEvent,
    };
  }

  const operation = plan.providerOperations[0];

  try {
    const activeEnrollments = operation.memberships.filter((m) => m.enrollmentState === "active");
    const withdrawnEnrollments = operation.memberships.filter((m) => m.enrollmentState === "withdrawn");

    if (activeEnrollments.length > 0) {
      const enrolments = activeEnrollments
        .map((m) => {
          const moodleUserId = personIdToMoodleUserId.get(m.personId);
          if (!moodleUserId) return null;
          const roleid = m.role === "student" ? 5 : 3;
          return { roleid, userid: moodleUserId, courseid: moodleCourseId };
        })
        .filter((e): e is { roleid: number; userid: number; courseid: number } => e !== null);

      if (enrolments.length > 0) {
        await httpClient.call("enrol_manual_enrol_users", { enrolments });
      }
    }

    if (withdrawnEnrollments.length > 0) {
      const unenrolments = withdrawnEnrollments
        .map((m) => {
          const moodleUserId = personIdToMoodleUserId.get(m.personId);
          if (!moodleUserId) return null;
          return { userid: moodleUserId, courseid: moodleCourseId };
        })
        .filter((e): e is { userid: number; courseid: number } => e !== null);

      if (unenrolments.length > 0) {
        await httpClient.call("enrol_manual_unenrol_users", { enrolments: unenrolments });
      }
    }

    await recordSuccess(tenantId, "moodle", db);

    return {
      result: {
        ...plan.result,
        status: "success",
        safeMessage: "Moodle roster sync completed successfully",
      },
      auditEvent: createLmsAuditEvent({
        ...plan.auditEvent,
        resultStatus: "success",
        metadata: {
          ...plan.auditEvent.redactedMetadata,
          enrolledCount: activeEnrollments.length,
          withdrawnCount: withdrawnEnrollments.length,
        },
      }),
    };
  } catch (error) {
    await recordFailure(tenantId, "moodle", db);

    if (error instanceof LmsProviderError) {
      return {
        result: {
          ...plan.result,
          status: error.retryable ? "retryable_failure" : "permanent_failure",
          safeMessage: error.message,
        },
        auditEvent: createLmsAuditEvent({
          ...plan.auditEvent,
          resultStatus: error.retryable ? "retryable_failure" : "permanent_failure",
          metadata: {
            ...plan.auditEvent.redactedMetadata,
            errorCode: error.code,
            httpStatus: error.httpStatus,
          },
        }),
      };
    }

    throw error;
  }
}
