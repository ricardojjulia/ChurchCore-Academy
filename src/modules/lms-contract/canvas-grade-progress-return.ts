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
import { CanvasHttpClient } from "./canvas-http-client";
import { CircuitBreakerDb, getCircuitState, recordSuccess, recordFailure } from "./circuit-breaker";

export interface CanvasReturnConfiguration {
  tenantId: string;
  importSourceLabel: string;
  accessToken?: string;
  refreshToken?: string;
  clientSecret?: string;
  sharedSecret?: string;
  webhookSecret?: string;
  rawProviderPayload?: unknown;
}

type CanvasReturnCapability = "grade_return" | "progress_return";

interface ReviewedImportBase {
  tenantId: string;
  providerId: "canvas";
  courseId: string;
  sectionId: string;
  importSourceLabel: string;
  idempotencyKey: string;
}

export interface CanvasGradeReturnReviewedImport extends ReviewedImportBase {
  importKind: "grade_return";
  results: Array<{
    studentPersonId: string;
    providerResultId: string;
    label: string;
    value: string;
    reviewStatus: LmsReviewedImportStatus;
  }>;
}

export interface CanvasProgressReturnReviewedImport extends ReviewedImportBase {
  importKind: "progress_return";
  results: Array<{
    studentPersonId: string;
    providerProgressId: string;
    label: string;
    summary: string;
    reviewStatus: LmsReviewedImportStatus;
  }>;
}

export interface CanvasReturnImportPlan<TImport> {
  result: LmsOperationResult;
  auditEvent: LmsAuditEvent;
  reviewedImport?: TImport;
}

export interface CreateCanvasGradeReturnImportPlanInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: CanvasReturnConfiguration;
  batch: LmsGradeReturnBatch;
}

export interface CreateCanvasProgressReturnImportPlanInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: CanvasReturnConfiguration;
  batch: LmsProgressReturnBatch;
}

function assertTenantMatch(input: {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: CanvasReturnConfiguration;
  batchTenantId: string;
}) {
  const expectedTenantId = input.resolvedProvider.tenant.tenantId;

  if (input.configuration.tenantId !== expectedTenantId || input.batchTenantId !== expectedTenantId) {
    throw new Error("Cannot create Canvas return import across tenants.");
  }
}

function assertIdempotencyKey(idempotencyKey: string) {
  if (!idempotencyKey.trim()) {
    throw new Error("Canvas return import requires an idempotency key.");
  }
}

function result(input: {
  tenantId: string;
  correlationId: string;
  capability: CanvasReturnCapability;
  operationId: string;
  safeMessage: string;
}): LmsOperationResult {
  return {
    status: "needs_review",
    providerId: "canvas",
    capability: input.capability,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    operationId: input.operationId,
    retryable: false,
    safeMessage: input.safeMessage,
  };
}

function gatedResult(resolvedProvider: ResolvedTenantLmsProvider, capability: CanvasReturnCapability, operationId: string) {
  return createUnsupportedLmsOperationResult({
    providerId: "canvas",
    capability,
    tenantId: resolvedProvider.tenant.tenantId,
    correlationId: resolvedProvider.tenant.correlationId,
    operationId,
    safeMessage: resolvedProvider.warnings[0] ?? "Canvas return import is not active for this tenant.",
  });
}

function emptyAuditEvent(input: {
  tenantId: string;
  capability: CanvasReturnCapability;
  targetReferences: string[];
  correlationId: string;
  operationId: string;
  safeMessage: string;
}) {
  return createLmsAuditEvent({
    tenantId: input.tenantId,
    providerId: "canvas",
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
  capability: CanvasReturnCapability;
  targetReferences: string[];
  correlationId: string;
  importSourceLabel: string;
  resultCount: number;
}) {
  return createLmsAuditEvent({
    tenantId: input.tenantId,
    providerId: "canvas",
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

export function createCanvasGradeReturnImportPlan(
  input: CreateCanvasGradeReturnImportPlanInput,
): CanvasReturnImportPlan<CanvasGradeReturnReviewedImport> {
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
      safeMessage: "Canvas grade return import is ready for Academy review.",
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
      providerId: "canvas",
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

export function createCanvasProgressReturnImportPlan(
  input: CreateCanvasProgressReturnImportPlanInput,
): CanvasReturnImportPlan<CanvasProgressReturnReviewedImport> {
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
      safeMessage: "Canvas progress return import is ready for Academy review.",
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
      providerId: "canvas",
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

export interface ExecuteCanvasProgressReturnInput {
  reviewedImport: CanvasProgressReturnReviewedImport;
  httpClient: CanvasHttpClient;
  db: CircuitBreakerDb;
  canvasCourseId: string;
  personIdToCanvasUserId: Map<string, number>;
}

export interface ExecuteCanvasProgressReturnResult {
  result: LmsOperationResult;
  auditEvent: LmsAuditEvent;
  updatedReviewedImport: CanvasProgressReturnReviewedImport;
}

export async function executeCanvasProgressReturn(
  input: ExecuteCanvasProgressReturnInput,
): Promise<ExecuteCanvasProgressReturnResult> {
  const tenantId = input.reviewedImport.tenantId;
  const correlationId = `canvas:progress_return:${input.reviewedImport.idempotencyKey}`;

  const circuitState = await getCircuitState(tenantId, "canvas", input.db);

  if (circuitState === "open") {
    return {
      result: {
        status: "retryable_failure",
        providerId: "canvas",
        capability: "progress_return",
        tenantId,
        correlationId,
        operationId: input.reviewedImport.idempotencyKey,
        retryable: true,
        safeMessage: "Canvas circuit breaker is open; operation skipped pending recovery.",
      },
      auditEvent: createLmsAuditEvent({
        tenantId,
        providerId: "canvas",
        operation: "progress_return",
        targetReferences: [input.reviewedImport.courseId, input.reviewedImport.sectionId],
        correlationId,
        resultStatus: "retryable_failure",
        metadata: { circuitState: "open" },
      }),
      updatedReviewedImport: input.reviewedImport,
    };
  }

  try {
    const modules = await input.httpClient.get<Array<{ id: number; name: string }>>(
      `/courses/${input.canvasCourseId}/modules`,
    );
    const moduleIds = new Set(modules.map((m) => String(m.id)));

    const updatedResults = input.reviewedImport.results.map((result) => {
      const canvasUserId = input.personIdToCanvasUserId.get(result.studentPersonId);
      if (!canvasUserId) {
        return { ...result, reviewStatus: "rejected" as LmsReviewedImportStatus };
      }

      if (moduleIds.has(result.providerProgressId)) {
        return { ...result, reviewStatus: "accepted_for_review" as LmsReviewedImportStatus };
      }

      return { ...result, reviewStatus: "pending_review" as LmsReviewedImportStatus };
    });

    await recordSuccess(tenantId, "canvas", input.db);

    return {
      result: {
        status: "success",
        providerId: "canvas",
        capability: "progress_return",
        tenantId,
        correlationId,
        operationId: input.reviewedImport.idempotencyKey,
        retryable: false,
        safeMessage: "Canvas progress return completed successfully.",
      },
      auditEvent: createLmsAuditEvent({
        tenantId,
        providerId: "canvas",
        operation: "progress_return",
        targetReferences: [input.reviewedImport.courseId, input.reviewedImport.sectionId],
        correlationId,
        resultStatus: "success",
        metadata: {
          importSourceLabel: input.reviewedImport.importSourceLabel,
          resultCount: updatedResults.length,
        },
      }),
      updatedReviewedImport: {
        ...input.reviewedImport,
        results: updatedResults,
      },
    };
  } catch (error) {
    await recordFailure(tenantId, "canvas", input.db);

    return {
      result: {
        status: "retryable_failure",
        providerId: "canvas",
        capability: "progress_return",
        tenantId,
        correlationId,
        operationId: input.reviewedImport.idempotencyKey,
        retryable: true,
        safeMessage: error instanceof Error ? error.message : "Canvas progress return failed.",
      },
      auditEvent: createLmsAuditEvent({
        tenantId,
        providerId: "canvas",
        operation: "progress_return",
        targetReferences: [input.reviewedImport.courseId, input.reviewedImport.sectionId],
        correlationId,
        resultStatus: "retryable_failure",
        metadata: {
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      }),
      updatedReviewedImport: input.reviewedImport,
    };
  }
}

export interface ExecuteCanvasGradeReturnInput {
  reviewedImport: CanvasGradeReturnReviewedImport;
  httpClient: CanvasHttpClient;
  db: CircuitBreakerDb;
  canvasCourseId: string;
  personIdToCanvasUserId: Map<string, number>;
}

export interface ExecuteCanvasGradeReturnResult {
  result: LmsOperationResult;
  auditEvent: LmsAuditEvent;
  updatedReviewedImport: CanvasGradeReturnReviewedImport;
}

export async function executeCanvasGradeReturn(
  input: ExecuteCanvasGradeReturnInput,
): Promise<ExecuteCanvasGradeReturnResult> {
  const tenantId = input.reviewedImport.tenantId;
  const correlationId = `canvas:grade_return:${input.reviewedImport.idempotencyKey}`;

  const circuitState = await getCircuitState(tenantId, "canvas", input.db);

  if (circuitState === "open") {
    return {
      result: {
        status: "retryable_failure",
        providerId: "canvas",
        capability: "grade_return",
        tenantId,
        correlationId,
        operationId: input.reviewedImport.idempotencyKey,
        retryable: true,
        safeMessage: "Canvas circuit breaker is open; operation skipped pending recovery.",
      },
      auditEvent: createLmsAuditEvent({
        tenantId,
        providerId: "canvas",
        operation: "grade_return",
        targetReferences: [input.reviewedImport.courseId, input.reviewedImport.sectionId],
        correlationId,
        resultStatus: "retryable_failure",
        metadata: {
          circuitState: "open",
        },
      }),
      updatedReviewedImport: input.reviewedImport,
    };
  }

  try {
    const updatedResults = [];

    for (const result of input.reviewedImport.results) {
      const canvasUserId = input.personIdToCanvasUserId.get(result.studentPersonId);
      if (!canvasUserId) {
        updatedResults.push({
          ...result,
          reviewStatus: "rejected" as LmsReviewedImportStatus,
        });
        continue;
      }

      try {
        const submissions = await input.httpClient.get<
          Array<{ id: number; grade: string; workflow_state: string }>
        >(`/courses/${input.canvasCourseId}/students/submissions`, {
          "student_ids[]": String(canvasUserId),
          "include[]": "assignment",
        });

        const matchingSubmission = submissions.find((s) => String(s.id) === result.providerResultId);

        if (matchingSubmission) {
          updatedResults.push({
            ...result,
            reviewStatus: "accepted_for_review" as LmsReviewedImportStatus,
          });
        } else {
          updatedResults.push({
            ...result,
            reviewStatus: "pending_review" as LmsReviewedImportStatus,
          });
        }
      } catch {
        updatedResults.push({
          ...result,
          reviewStatus: "rejected" as LmsReviewedImportStatus,
        });
      }
    }

    await recordSuccess(tenantId, "canvas", input.db);

    return {
      result: {
        status: "success",
        providerId: "canvas",
        capability: "grade_return",
        tenantId,
        correlationId,
        operationId: input.reviewedImport.idempotencyKey,
        retryable: false,
        safeMessage: "Canvas grade return completed successfully.",
      },
      auditEvent: createLmsAuditEvent({
        tenantId,
        providerId: "canvas",
        operation: "grade_return",
        targetReferences: [input.reviewedImport.courseId, input.reviewedImport.sectionId],
        correlationId,
        resultStatus: "success",
        metadata: {
          importSourceLabel: input.reviewedImport.importSourceLabel,
          resultCount: updatedResults.length,
        },
      }),
      updatedReviewedImport: {
        ...input.reviewedImport,
        results: updatedResults,
      },
    };
  } catch (error) {
    await recordFailure(tenantId, "canvas", input.db);

    return {
      result: {
        status: "retryable_failure",
        providerId: "canvas",
        capability: "grade_return",
        tenantId,
        correlationId,
        operationId: input.reviewedImport.idempotencyKey,
        retryable: true,
        safeMessage: error instanceof Error ? error.message : "Canvas grade return failed.",
      },
      auditEvent: createLmsAuditEvent({
        tenantId,
        providerId: "canvas",
        operation: "grade_return",
        targetReferences: [input.reviewedImport.courseId, input.reviewedImport.sectionId],
        correlationId,
        resultStatus: "retryable_failure",
        metadata: {
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      }),
      updatedReviewedImport: input.reviewedImport,
    };
  }
}
