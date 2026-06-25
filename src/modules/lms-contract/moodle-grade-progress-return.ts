import {
  LmsAuditEvent,
  LmsGradeReturnBatch,
  LmsOperationResult,
  LmsProgressReturnBatch,
  LmsReviewedImportStatus,
  createUnsupportedLmsOperationResult,
} from "./contract";
import { createLmsAuditEvent } from "./sync-audit-reconciliation";
import { ResolvedTenantLmsProvider } from "./tenant-provider-selection";
import { MoodleHttpClient, LmsProviderError } from "./moodle-http-client";
import { CircuitBreakerDb, getCircuitState, recordFailure, recordSuccess } from "./circuit-breaker";

export interface MoodleReturnConfiguration {
  tenantId: string;
  importSourceLabel: string;
  accessToken?: string;
  refreshToken?: string;
  clientSecret?: string;
  sharedSecret?: string;
  webhookSecret?: string;
  rawProviderPayload?: unknown;
}

type MoodleReturnCapability = "grade_return" | "progress_return";

interface ReviewedImportBase {
  tenantId: string;
  providerId: "moodle";
  courseId: string;
  sectionId: string;
  importSourceLabel: string;
  idempotencyKey: string;
}

export interface MoodleGradeReturnReviewedImport extends ReviewedImportBase {
  importKind: "grade_return";
  results: Array<{
    studentPersonId: string;
    providerResultId: string;
    label: string;
    value: string;
    reviewStatus: LmsReviewedImportStatus;
  }>;
}

export interface MoodleProgressReturnReviewedImport extends ReviewedImportBase {
  importKind: "progress_return";
  results: Array<{
    studentPersonId: string;
    providerProgressId: string;
    label: string;
    summary: string;
    reviewStatus: LmsReviewedImportStatus;
  }>;
}

export interface MoodleReturnImportPlan<TImport> {
  result: LmsOperationResult;
  auditEvent: LmsAuditEvent;
  reviewedImport?: TImport;
}

export interface CreateMoodleGradeReturnImportPlanInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: MoodleReturnConfiguration;
  batch: LmsGradeReturnBatch;
}

export interface CreateMoodleProgressReturnImportPlanInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: MoodleReturnConfiguration;
  batch: LmsProgressReturnBatch;
}

function assertTenantMatch(input: {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: MoodleReturnConfiguration;
  batchTenantId: string;
}) {
  const expectedTenantId = input.resolvedProvider.tenant.tenantId;

  if (input.configuration.tenantId !== expectedTenantId || input.batchTenantId !== expectedTenantId) {
    throw new Error("Cannot create Moodle return import across tenants.");
  }
}

function assertIdempotencyKey(idempotencyKey: string) {
  if (!idempotencyKey.trim()) {
    throw new Error("Moodle return import requires an idempotency key.");
  }
}

function result(input: {
  tenantId: string;
  correlationId: string;
  capability: MoodleReturnCapability;
  operationId: string;
  safeMessage: string;
}): LmsOperationResult {
  return {
    status: "needs_review",
    providerId: "moodle",
    capability: input.capability,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    operationId: input.operationId,
    retryable: false,
    safeMessage: input.safeMessage,
  };
}

function gatedResult(resolvedProvider: ResolvedTenantLmsProvider, capability: MoodleReturnCapability, operationId: string) {
  return createUnsupportedLmsOperationResult({
    providerId: "moodle",
    capability,
    tenantId: resolvedProvider.tenant.tenantId,
    correlationId: resolvedProvider.tenant.correlationId,
    operationId,
    safeMessage: resolvedProvider.warnings[0] ?? "Moodle return import is not active for this tenant.",
  });
}

function emptyAuditEvent(input: {
  tenantId: string;
  capability: MoodleReturnCapability;
  targetReferences: string[];
  correlationId: string;
  operationId: string;
  safeMessage: string;
}) {
  return createLmsAuditEvent({
    tenantId: input.tenantId,
    providerId: "moodle",
    operation: input.capability,
    targetReferences: input.targetReferences,
    correlationId: input.correlationId,
    resultStatus: "unsupported",
    metadata: {
      operationId: input.operationId,
      safeMessage: input.safeMessage,
    },
  });
}

function auditEvent(input: {
  tenantId: string;
  capability: MoodleReturnCapability;
  targetReferences: string[];
  correlationId: string;
  importSourceLabel: string;
  resultCount: number;
}) {
  return createLmsAuditEvent({
    tenantId: input.tenantId,
    providerId: "moodle",
    operation: input.capability,
    targetReferences: input.targetReferences,
    correlationId: input.correlationId,
    resultStatus: "needs_review",
    metadata: {
      importSourceLabel: input.importSourceLabel,
      resultCount: input.resultCount,
      pendingReviewCount: input.resultCount,
    },
  });
}

function targetReferences(batch: Pick<LmsGradeReturnBatch | LmsProgressReturnBatch, "courseId" | "sectionId">) {
  return [batch.courseId, batch.sectionId];
}

export function createMoodleGradeReturnImportPlan(
  input: CreateMoodleGradeReturnImportPlanInput,
): MoodleReturnImportPlan<MoodleGradeReturnReviewedImport> {
  assertTenantMatch({
    resolvedProvider: input.resolvedProvider,
    configuration: input.configuration,
    batchTenantId: input.batch.tenant.tenantId,
  });
  assertIdempotencyKey(input.batch.idempotencyKey);

  const tenantId = input.batch.tenant.tenantId;
  const references = targetReferences(input.batch);

  if (!input.resolvedProvider.supports("grade_return")) {
    const unsupported = gatedResult(input.resolvedProvider, "grade_return", input.batch.idempotencyKey);

    return {
      result: unsupported,
      auditEvent: emptyAuditEvent({
        tenantId,
        capability: "grade_return",
        targetReferences: references,
        correlationId: input.batch.tenant.correlationId,
        operationId: input.batch.idempotencyKey,
        safeMessage: unsupported.safeMessage,
      }),
    };
  }

  return {
    result: result({
      tenantId,
      correlationId: input.batch.tenant.correlationId,
      capability: "grade_return",
      operationId: input.batch.idempotencyKey,
      safeMessage: "Moodle grade return import is ready for Academy review.",
    }),
    auditEvent: auditEvent({
      tenantId,
      capability: "grade_return",
      targetReferences: references,
      correlationId: input.batch.tenant.correlationId,
      importSourceLabel: input.configuration.importSourceLabel,
      resultCount: input.batch.results.length,
    }),
    reviewedImport: {
      tenantId,
      providerId: "moodle",
      courseId: input.batch.courseId,
      sectionId: input.batch.sectionId,
      importSourceLabel: input.configuration.importSourceLabel,
      importKind: "grade_return",
      idempotencyKey: input.batch.idempotencyKey,
      results: input.batch.results.map((item) => ({
        studentPersonId: item.studentPersonId,
        providerResultId: item.providerResultId,
        label: item.label,
        value: item.value,
        reviewStatus: "pending_review",
      })),
    },
  };
}

export function createMoodleProgressReturnImportPlan(
  input: CreateMoodleProgressReturnImportPlanInput,
): MoodleReturnImportPlan<MoodleProgressReturnReviewedImport> {
  assertTenantMatch({
    resolvedProvider: input.resolvedProvider,
    configuration: input.configuration,
    batchTenantId: input.batch.tenant.tenantId,
  });
  assertIdempotencyKey(input.batch.idempotencyKey);

  const tenantId = input.batch.tenant.tenantId;
  const references = targetReferences(input.batch);

  if (!input.resolvedProvider.supports("progress_return")) {
    const unsupported = gatedResult(input.resolvedProvider, "progress_return", input.batch.idempotencyKey);

    return {
      result: unsupported,
      auditEvent: emptyAuditEvent({
        tenantId,
        capability: "progress_return",
        targetReferences: references,
        correlationId: input.batch.tenant.correlationId,
        operationId: input.batch.idempotencyKey,
        safeMessage: unsupported.safeMessage,
      }),
    };
  }

  return {
    result: result({
      tenantId,
      correlationId: input.batch.tenant.correlationId,
      capability: "progress_return",
      operationId: input.batch.idempotencyKey,
      safeMessage: "Moodle progress return import is ready for Academy review.",
    }),
    auditEvent: auditEvent({
      tenantId,
      capability: "progress_return",
      targetReferences: references,
      correlationId: input.batch.tenant.correlationId,
      importSourceLabel: input.configuration.importSourceLabel,
      resultCount: input.batch.results.length,
    }),
    reviewedImport: {
      tenantId,
      providerId: "moodle",
      courseId: input.batch.courseId,
      sectionId: input.batch.sectionId,
      importSourceLabel: input.configuration.importSourceLabel,
      importKind: "progress_return",
      idempotencyKey: input.batch.idempotencyKey,
      results: input.batch.results.map((item) => ({
        studentPersonId: item.studentPersonId,
        providerProgressId: item.providerProgressId,
        label: item.label,
        summary: item.summary,
        reviewStatus: "pending_review",
      })),
    },
  };
}

export interface ExecuteMoodleGradeReturnInput {
  reviewedImport: MoodleGradeReturnReviewedImport;
  httpClient: MoodleHttpClient;
  db: CircuitBreakerDb;
  moodleCourseId: number;
  moodleUserIdToPersonId: Map<number, string>;
}

export async function executeMoodleGradeReturn(
  input: ExecuteMoodleGradeReturnInput,
): Promise<MoodleReturnImportPlan<MoodleGradeReturnReviewedImport>> {
  const { reviewedImport, httpClient, db, moodleCourseId, moodleUserIdToPersonId } = input;
  const tenantId = reviewedImport.tenantId;

  const circuitState = await getCircuitState(tenantId, "moodle", db);
  if (circuitState === "open") {
    return {
      result: {
        status: "retryable_failure",
        providerId: "moodle",
        capability: "grade_return",
        tenantId,
        correlationId: reviewedImport.idempotencyKey,
        operationId: reviewedImport.idempotencyKey,
        retryable: true,
        safeMessage: "Moodle integration circuit breaker is open",
      },
      auditEvent: createLmsAuditEvent({
        tenantId,
        providerId: "moodle",
        operation: "grade_return",
        targetReferences: [reviewedImport.courseId, reviewedImport.sectionId],
        correlationId: reviewedImport.idempotencyKey,
        resultStatus: "retryable_failure",
        metadata: { circuitState: "open" },
      }),
    };
  }

  try {
    interface MoodleGradeItem {
      id: number;
      itemname: string;
      graderaw?: number;
      gradeformatted?: string;
    }

    const gradeData = await httpClient.call<{ usergrades: Array<{ gradeitems: MoodleGradeItem[] }> }>(
      "gradereport_user_get_grade_items",
      {
        courseid: moodleCourseId,
      },
    );

    const results: MoodleGradeReturnReviewedImport["results"] = [];

    for (const userGrade of gradeData.usergrades || []) {
      for (const item of userGrade.gradeitems || []) {
        const personId = moodleUserIdToPersonId.get(item.id);
        if (!personId) continue;

        results.push({
          studentPersonId: personId,
          providerResultId: String(item.id),
          label: item.itemname,
          value: item.gradeformatted || String(item.graderaw || ""),
          reviewStatus: "pending_review",
        });
      }
    }

    await recordSuccess(tenantId, "moodle", db);

    return {
      result: {
        status: "needs_review",
        providerId: "moodle",
        capability: "grade_return",
        tenantId,
        correlationId: reviewedImport.idempotencyKey,
        operationId: reviewedImport.idempotencyKey,
        retryable: false,
        safeMessage: "Moodle grade return import completed",
      },
      auditEvent: createLmsAuditEvent({
        tenantId,
        providerId: "moodle",
        operation: "grade_return",
        targetReferences: [reviewedImport.courseId, reviewedImport.sectionId],
        correlationId: reviewedImport.idempotencyKey,
        resultStatus: "needs_review",
        metadata: {
          importSourceLabel: reviewedImport.importSourceLabel,
          resultCount: results.length,
          pendingReviewCount: results.length,
        },
      }),
      reviewedImport: {
        ...reviewedImport,
        results,
      },
    };
  } catch (error) {
    await recordFailure(tenantId, "moodle", db);

    if (error instanceof LmsProviderError) {
      return {
        result: {
          status: error.retryable ? "retryable_failure" : "permanent_failure",
          providerId: "moodle",
          capability: "grade_return",
          tenantId,
          correlationId: reviewedImport.idempotencyKey,
          operationId: reviewedImport.idempotencyKey,
          retryable: error.retryable,
          safeMessage: error.message,
        },
        auditEvent: createLmsAuditEvent({
          tenantId,
          providerId: "moodle",
          operation: "grade_return",
          targetReferences: [reviewedImport.courseId, reviewedImport.sectionId],
          correlationId: reviewedImport.idempotencyKey,
          resultStatus: error.retryable ? "retryable_failure" : "permanent_failure",
          metadata: {
            errorCode: error.code,
            httpStatus: error.httpStatus,
          },
        }),
      };
    }

    throw error;
  }
}
