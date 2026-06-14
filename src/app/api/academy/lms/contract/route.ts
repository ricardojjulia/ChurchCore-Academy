import { randomUUID } from "node:crypto";
import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { AcademyActor, assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveBootstrapAcademyActor } from "@/modules/academy-auth/request-context";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import { InstitutionProfile } from "@/modules/academy-config/types";
import {
  CourseLmsMappingStatus,
  CourseLmsSyncPolicy,
} from "@/modules/course-catalog/types";
import {
  createCanvasGradeReturnImportPlan,
  createCanvasProgressReturnImportPlan,
} from "@/modules/lms-contract/canvas-grade-progress-return";
import {
  createUnsupportedLmsOperationResult,
  LmsActorContext,
  LmsCourseShellRequest,
  LmsGradeReturnBatch,
  LmsProgressReturnBatch,
  LmsRosterSyncRequest,
  LmsReviewedImportStatus,
  lmsProviderDescriptors,
} from "@/modules/lms-contract/contract";
import { createCanvasCourseShellProvisioningPlan, createCanvasRosterSyncPlan } from "@/modules/lms-contract/canvas-course-roster-sync";
import { resolveTenantLmsProvider } from "@/modules/lms-contract/tenant-provider-selection";

interface InstitutionProfileReader {
  fetchInstitutionProfile(tenantId: string): Promise<InstitutionProfile>;
}

const mappingStatuses = new Set<CourseLmsMappingStatus>([
  "not_required",
  "planned",
  "ready_to_provision",
  "mapped",
  "needs_review",
  "disabled",
]);

const syncPolicies = new Set<CourseLmsSyncPolicy>([
  "manual",
  "provision_shell_only",
  "roster_sync",
  "grade_return",
  "full_section_sync",
]);

const enrollmentStates = new Set<LmsRosterSyncRequest["enrollmentStates"][string]>([
  "active",
  "paused",
  "withdrawn",
  "completed",
]);

interface CourseShellPlanInput {
  courseId: string;
  sectionId?: string;
  academicYearId: string;
  academicPeriodId: string;
  subdivisionId?: string;
  mappingIntent: CourseLmsMappingStatus;
  syncPolicy: CourseLmsSyncPolicy;
  idempotencyKey: string;
}

interface RosterSyncPlanInput {
  sectionId: string;
  instructorPersonIds: string[];
  studentPersonIds: string[];
  enrollmentStates: Record<string, "active" | "paused" | "withdrawn" | "completed">;
  idempotencyKey: string;
}

interface GradeReturnPlanInput {
  courseId: string;
  sectionId: string;
  idempotencyKey: string;
  importSourceLabel: string;
  results: LmsGradeReturnBatch["results"];
}

interface ProgressReturnPlanInput {
  courseId: string;
  sectionId: string;
  idempotencyKey: string;
  importSourceLabel: string;
  results: LmsProgressReturnBatch["results"];
}

const reviewedImportStatuses = new Set<LmsReviewedImportStatus>([
  "pending_review",
  "accepted_for_review",
  "rejected",
  "superseded",
]);

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function buildActorContext(actor: AcademyActor): LmsActorContext {
  return {
    personId: actor.userId,
    role: actor.roles[0] ?? "institution_admin",
    auditActorId: `actor:${actor.userId}`,
  };
}

function correlationId(headers: Headers) {
  return asString(headers.get("x-correlation-id")) ?? `corr-lms-contract-${randomUUID()}`;
}

function parseCourseShellPlanInput(body: unknown): CourseShellPlanInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid contract request payload.");
  }

  const payload = body as Record<string, unknown>;
  const courseId = asString(payload.courseId);
  const academicYearId = asString(payload.academicYearId);
  const academicPeriodId = asString(payload.academicPeriodId);
  const mappingIntent = asString(payload.mappingIntent) as CourseLmsMappingStatus | undefined;
  const syncPolicy = asString(payload.syncPolicy) as CourseLmsSyncPolicy | undefined;
  const idempotencyKey = asString(payload.idempotencyKey);

  if (!courseId || !academicYearId || !academicPeriodId || !idempotencyKey) {
    throw new Error("courseId, academicYearId, academicPeriodId, and idempotencyKey are required.");
  }

  if (!mappingIntent || !mappingStatuses.has(mappingIntent)) {
    throw new Error("Invalid mappingIntent.");
  }

  if (!syncPolicy || !syncPolicies.has(syncPolicy)) {
    throw new Error("Invalid syncPolicy.");
  }

  return {
    courseId,
    sectionId: asString(payload.sectionId),
    academicYearId,
    academicPeriodId,
    subdivisionId: asString(payload.subdivisionId),
    mappingIntent,
    syncPolicy,
    idempotencyKey,
  };
}

function parseRosterSyncPlanInput(body: unknown): RosterSyncPlanInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid contract request payload.");
  }

  const payload = body as Record<string, unknown>;
  const sectionId = asString(payload.sectionId);
  const idempotencyKey = asString(payload.idempotencyKey);
  const instructorPersonIds = asStringArray(payload.instructorPersonIds);
  const studentPersonIds = asStringArray(payload.studentPersonIds);
  const enrollmentStatesValue = payload.enrollmentStates;

  if (!sectionId || !idempotencyKey) {
    throw new Error("sectionId and idempotencyKey are required.");
  }

  if (!enrollmentStatesValue || typeof enrollmentStatesValue !== "object") {
    throw new Error("enrollmentStates is required.");
  }

  const parsedEnrollmentStates = Object.entries(enrollmentStatesValue as Record<string, unknown>).reduce(
    (acc, [personId, state]) => {
      const stateValue = asString(state) as RosterSyncPlanInput["enrollmentStates"][string] | undefined;
      if (!stateValue || !enrollmentStates.has(stateValue)) {
        throw new Error("Invalid enrollment state in enrollmentStates.");
      }

      acc[personId] = stateValue;
      return acc;
    },
    {} as RosterSyncPlanInput["enrollmentStates"],
  );

  return {
    sectionId,
    instructorPersonIds,
    studentPersonIds,
    enrollmentStates: parsedEnrollmentStates,
    idempotencyKey,
  };
}

function parseGradeReturnPlanInput(body: unknown): GradeReturnPlanInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid contract request payload.");
  }

  const payload = body as Record<string, unknown>;
  const courseId = asString(payload.courseId);
  const sectionId = asString(payload.sectionId);
  const idempotencyKey = asString(payload.idempotencyKey);
  const importSourceLabel = asString(payload.importSourceLabel);

  if (!courseId || !sectionId || !idempotencyKey || !importSourceLabel) {
    throw new Error("courseId, sectionId, idempotencyKey, and importSourceLabel are required.");
  }

  const results = Array.isArray(payload.results)
    ? payload.results.map((result): LmsGradeReturnBatch["results"][number] => {
        if (!result || typeof result !== "object") {
          throw new Error("Invalid grade_return results payload.");
        }

        const item = result as Record<string, unknown>;
        const studentPersonId = asString(item.studentPersonId);
        const providerResultId = asString(item.providerResultId);
        const label = asString(item.label);
        const value = asString(item.value);
        const reviewStatus = asString(item.reviewStatus) as LmsReviewedImportStatus | undefined;

        if (!studentPersonId || !providerResultId || !label || !value || !reviewStatus || !reviewedImportStatuses.has(reviewStatus)) {
          throw new Error("Invalid grade_return result entry.");
        }

        return {
          studentPersonId,
          providerResultId,
          label,
          value,
          reviewStatus,
        };
      })
    : [];

  return {
    courseId,
    sectionId,
    idempotencyKey,
    importSourceLabel,
    results,
  };
}

function parseProgressReturnPlanInput(body: unknown): ProgressReturnPlanInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid contract request payload.");
  }

  const payload = body as Record<string, unknown>;
  const courseId = asString(payload.courseId);
  const sectionId = asString(payload.sectionId);
  const idempotencyKey = asString(payload.idempotencyKey);
  const importSourceLabel = asString(payload.importSourceLabel);

  if (!courseId || !sectionId || !idempotencyKey || !importSourceLabel) {
    throw new Error("courseId, sectionId, idempotencyKey, and importSourceLabel are required.");
  }

  const results = Array.isArray(payload.results)
    ? payload.results.map((result): LmsProgressReturnBatch["results"][number] => {
        if (!result || typeof result !== "object") {
          throw new Error("Invalid progress_return results payload.");
        }

        const item = result as Record<string, unknown>;
        const studentPersonId = asString(item.studentPersonId);
        const providerProgressId = asString(item.providerProgressId);
        const label = asString(item.label);
        const summary = asString(item.summary);
        const reviewStatus = asString(item.reviewStatus) as LmsReviewedImportStatus | undefined;

        if (
          !studentPersonId ||
          !providerProgressId ||
          !label ||
          !summary ||
          !reviewStatus ||
          !reviewedImportStatuses.has(reviewStatus)
        ) {
          throw new Error("Invalid progress_return result entry.");
        }

        return {
          studentPersonId,
          providerProgressId,
          label,
          summary,
          reviewStatus,
        };
      })
    : [];

  return {
    courseId,
    sectionId,
    idempotencyKey,
    importSourceLabel,
    results,
  };
}

export async function buildLmsContractDescriptorPayload(
  repository: InstitutionProfileReader,
  actor: AcademyActor,
  tenantId: string,
  requestCorrelationId: string,
) {
  assertInstitutionConfigAccess(actor, tenantId, "read");

  const profile = await repository.fetchInstitutionProfile(tenantId);
  const resolved = resolveTenantLmsProvider(profile, {
    tenantId,
    correlationId: requestCorrelationId,
  });

  return {
    tenant: resolved.tenant,
    provider: {
      id: resolved.descriptor.id,
      displayName: resolved.descriptor.displayName,
      configurationStatus: resolved.descriptor.configurationStatus,
      capabilities: resolved.descriptor.capabilities,
    },
    warnings: resolved.warnings,
    descriptors: lmsProviderDescriptors.map((descriptor) => ({
      id: descriptor.id,
      displayName: descriptor.displayName,
      capabilities: descriptor.capabilities,
    })),
  };
}

function unsupportedCourseShellPlan(actor: AcademyActor, tenantId: string, requestCorrelationId: string, idempotencyKey: string) {
  return {
    result: createUnsupportedLmsOperationResult({
      providerId: "moodle",
      capability: "course_shell_provisioning",
      tenantId,
      correlationId: requestCorrelationId,
      operationId: idempotencyKey,
      safeMessage: "Moodle course-shell API contract stub is not implemented yet.",
    }),
    auditEvent: {
      tenantId,
      providerId: "moodle",
      operation: "course_shell_provisioning",
      actorPersonId: actor.userId,
      targetReferences: [],
      correlationId: requestCorrelationId,
      resultStatus: "unsupported",
      redactedMetadata: {},
    },
    providerOperations: [],
  };
}

function unsupportedRosterSyncPlan(actor: AcademyActor, tenantId: string, requestCorrelationId: string, idempotencyKey: string) {
  return {
    result: createUnsupportedLmsOperationResult({
      providerId: "moodle",
      capability: "roster_sync",
      tenantId,
      correlationId: requestCorrelationId,
      operationId: idempotencyKey,
      safeMessage: "Moodle roster-sync API contract stub is not implemented yet.",
    }),
    auditEvent: {
      tenantId,
      providerId: "moodle",
      operation: "roster_sync",
      actorPersonId: actor.userId,
      targetReferences: [],
      correlationId: requestCorrelationId,
      resultStatus: "unsupported",
      redactedMetadata: {},
    },
    providerOperations: [],
  };
}

function unsupportedGradeReturnPlan(actor: AcademyActor, tenantId: string, requestCorrelationId: string, idempotencyKey: string) {
  return {
    result: createUnsupportedLmsOperationResult({
      providerId: "moodle",
      capability: "grade_return",
      tenantId,
      correlationId: requestCorrelationId,
      operationId: idempotencyKey,
      safeMessage: "Moodle grade-return API contract stub is not implemented yet.",
    }),
    auditEvent: {
      tenantId,
      providerId: "moodle",
      operation: "grade_return",
      actorPersonId: actor.userId,
      targetReferences: [],
      correlationId: requestCorrelationId,
      resultStatus: "unsupported",
      redactedMetadata: {},
    },
    reviewedImport: undefined,
  };
}

function unsupportedProgressReturnPlan(actor: AcademyActor, tenantId: string, requestCorrelationId: string, idempotencyKey: string) {
  return {
    result: createUnsupportedLmsOperationResult({
      providerId: "moodle",
      capability: "progress_return",
      tenantId,
      correlationId: requestCorrelationId,
      operationId: idempotencyKey,
      safeMessage: "Moodle progress-return API contract stub is not implemented yet.",
    }),
    auditEvent: {
      tenantId,
      providerId: "moodle",
      operation: "progress_return",
      actorPersonId: actor.userId,
      targetReferences: [],
      correlationId: requestCorrelationId,
      resultStatus: "unsupported",
      redactedMetadata: {},
    },
    reviewedImport: undefined,
  };
}

export async function buildLmsCourseShellPlanPayload(
  repository: InstitutionProfileReader,
  actor: AcademyActor,
  tenantId: string,
  requestCorrelationId: string,
  input: CourseShellPlanInput,
) {
  assertInstitutionConfigAccess(actor, tenantId, "admin");

  const profile = await repository.fetchInstitutionProfile(tenantId);
  const resolved = resolveTenantLmsProvider(profile, {
    tenantId,
    correlationId: requestCorrelationId,
  });
  const request: LmsCourseShellRequest = {
    tenant: resolved.tenant,
    actor: buildActorContext(actor),
    courseId: input.courseId,
    sectionId: input.sectionId,
    academicYearId: input.academicYearId,
    academicPeriodId: input.academicPeriodId,
    subdivisionId: input.subdivisionId,
    mappingIntent: input.mappingIntent,
    syncPolicy: input.syncPolicy,
    idempotencyKey: input.idempotencyKey,
  };

  if (resolved.tenant.providerId === "canvas") {
    const plan = createCanvasCourseShellProvisioningPlan({
      resolvedProvider: resolved,
      configuration: {
        tenantId,
        defaultInstructorRole: "teacher",
        defaultStudentRole: "student",
      },
      request,
    });

    return {
      operation: "course_shell_plan",
      providerId: resolved.tenant.providerId,
      plan,
    };
  }

  if (resolved.tenant.providerId === "none") {
    return {
      operation: "course_shell_plan",
      providerId: resolved.tenant.providerId,
      plan: {
        result: resolved.provider?.unsupported("course_shell_provisioning", resolved.tenant, input.idempotencyKey),
        auditEvent: undefined,
        providerOperations: [],
      },
    };
  }

  return {
    operation: "course_shell_plan",
    providerId: resolved.tenant.providerId,
    plan: unsupportedCourseShellPlan(actor, tenantId, requestCorrelationId, input.idempotencyKey),
  };
}

export async function buildLmsRosterSyncPlanPayload(
  repository: InstitutionProfileReader,
  actor: AcademyActor,
  tenantId: string,
  requestCorrelationId: string,
  input: RosterSyncPlanInput,
) {
  assertInstitutionConfigAccess(actor, tenantId, "admin");

  const profile = await repository.fetchInstitutionProfile(tenantId);
  const resolved = resolveTenantLmsProvider(profile, {
    tenantId,
    correlationId: requestCorrelationId,
  });
  const request: LmsRosterSyncRequest = {
    tenant: resolved.tenant,
    actor: buildActorContext(actor),
    sectionId: input.sectionId,
    instructorPersonIds: input.instructorPersonIds,
    studentPersonIds: input.studentPersonIds,
    enrollmentStates: input.enrollmentStates,
    idempotencyKey: input.idempotencyKey,
  };

  if (resolved.tenant.providerId === "canvas") {
    const plan = createCanvasRosterSyncPlan({
      resolvedProvider: resolved,
      configuration: {
        tenantId,
        defaultInstructorRole: "teacher",
        defaultStudentRole: "student",
      },
      request,
    });

    return {
      operation: "roster_sync_plan",
      providerId: resolved.tenant.providerId,
      plan,
    };
  }

  if (resolved.tenant.providerId === "none") {
    return {
      operation: "roster_sync_plan",
      providerId: resolved.tenant.providerId,
      plan: {
        result: resolved.provider?.unsupported("roster_sync", resolved.tenant, input.idempotencyKey),
        auditEvent: undefined,
        providerOperations: [],
      },
    };
  }

  return {
    operation: "roster_sync_plan",
    providerId: resolved.tenant.providerId,
    plan: unsupportedRosterSyncPlan(actor, tenantId, requestCorrelationId, input.idempotencyKey),
  };
}

export async function buildLmsGradeReturnPlanPayload(
  repository: InstitutionProfileReader,
  actor: AcademyActor,
  tenantId: string,
  requestCorrelationId: string,
  input: GradeReturnPlanInput,
) {
  assertInstitutionConfigAccess(actor, tenantId, "admin");

  const profile = await repository.fetchInstitutionProfile(tenantId);
  const resolved = resolveTenantLmsProvider(profile, {
    tenantId,
    correlationId: requestCorrelationId,
  });
  const batch: LmsGradeReturnBatch = {
    tenant: resolved.tenant,
    providerId: resolved.tenant.providerId,
    courseId: input.courseId,
    sectionId: input.sectionId,
    results: input.results,
    idempotencyKey: input.idempotencyKey,
  };

  if (resolved.tenant.providerId === "canvas") {
    const plan = createCanvasGradeReturnImportPlan({
      resolvedProvider: resolved,
      configuration: {
        tenantId,
        importSourceLabel: input.importSourceLabel,
      },
      batch,
    });

    return {
      operation: "grade_return_plan",
      providerId: resolved.tenant.providerId,
      plan,
    };
  }

  if (resolved.tenant.providerId === "none") {
    return {
      operation: "grade_return_plan",
      providerId: resolved.tenant.providerId,
      plan: {
        result: resolved.provider?.unsupported("grade_return", resolved.tenant, input.idempotencyKey),
        auditEvent: undefined,
        reviewedImport: undefined,
      },
    };
  }

  return {
    operation: "grade_return_plan",
    providerId: resolved.tenant.providerId,
    plan: unsupportedGradeReturnPlan(actor, tenantId, requestCorrelationId, input.idempotencyKey),
  };
}

export async function buildLmsProgressReturnPlanPayload(
  repository: InstitutionProfileReader,
  actor: AcademyActor,
  tenantId: string,
  requestCorrelationId: string,
  input: ProgressReturnPlanInput,
) {
  assertInstitutionConfigAccess(actor, tenantId, "admin");

  const profile = await repository.fetchInstitutionProfile(tenantId);
  const resolved = resolveTenantLmsProvider(profile, {
    tenantId,
    correlationId: requestCorrelationId,
  });
  const batch: LmsProgressReturnBatch = {
    tenant: resolved.tenant,
    providerId: resolved.tenant.providerId,
    courseId: input.courseId,
    sectionId: input.sectionId,
    results: input.results,
    idempotencyKey: input.idempotencyKey,
  };

  if (resolved.tenant.providerId === "canvas") {
    const plan = createCanvasProgressReturnImportPlan({
      resolvedProvider: resolved,
      configuration: {
        tenantId,
        importSourceLabel: input.importSourceLabel,
      },
      batch,
    });

    return {
      operation: "progress_return_plan",
      providerId: resolved.tenant.providerId,
      plan,
    };
  }

  if (resolved.tenant.providerId === "none") {
    return {
      operation: "progress_return_plan",
      providerId: resolved.tenant.providerId,
      plan: {
        result: resolved.provider?.unsupported("progress_return", resolved.tenant, input.idempotencyKey),
        auditEvent: undefined,
        reviewedImport: undefined,
      },
    };
  }

  return {
    operation: "progress_return_plan",
    providerId: resolved.tenant.providerId,
    plan: unsupportedProgressReturnPlan(actor, tenantId, requestCorrelationId, input.idempotencyKey),
  };
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const actor = resolveBootstrapAcademyActor(request.headers);
    const requestCorrelationId = correlationId(request.headers);

    return buildLmsContractDescriptorPayload(new AcademyConfigRepository(), actor, actor.tenantId, requestCorrelationId);
  });
}

export async function POST(request: Request) {
  const actor = resolveBootstrapAcademyActor(request.headers);
  const requestCorrelationId = correlationId(request.headers);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError("Invalid contract request payload.", 400);
  }

  const payload = body as Record<string, unknown>;
  const operation = asString(payload.operation);

  if (!operation) {
    return jsonError("operation is required.", 400);
  }

  if (operation === "course_shell_plan") {
    try {
      const input = parseCourseShellPlanInput(payload);
      return handleApi(async () =>
        buildLmsCourseShellPlanPayload(new AcademyConfigRepository(), actor, actor.tenantId, requestCorrelationId, input),
      );
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid contract request payload.", 400);
    }
  }

  if (operation === "roster_sync_plan") {
    try {
      const input = parseRosterSyncPlanInput(payload);
      return handleApi(async () =>
        buildLmsRosterSyncPlanPayload(new AcademyConfigRepository(), actor, actor.tenantId, requestCorrelationId, input),
      );
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid contract request payload.", 400);
    }
  }

  if (operation === "grade_return_plan") {
    try {
      const input = parseGradeReturnPlanInput(payload);
      return handleApi(async () =>
        buildLmsGradeReturnPlanPayload(new AcademyConfigRepository(), actor, actor.tenantId, requestCorrelationId, input),
      );
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid contract request payload.", 400);
    }
  }

  if (operation === "progress_return_plan") {
    try {
      const input = parseProgressReturnPlanInput(payload);
      return handleApi(async () =>
        buildLmsProgressReturnPlanPayload(new AcademyConfigRepository(), actor, actor.tenantId, requestCorrelationId, input),
      );
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid contract request payload.", 400);
    }
  }

  return jsonError("Invalid operation.", 400);
}
