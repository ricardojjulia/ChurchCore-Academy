import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile, LmsSelectionStatus } from "@/modules/academy-config/types";
import { LmsGradeReturnBatch, LmsProgressReturnBatch } from "../contract";
import {
  CanvasReturnConfiguration,
  createCanvasGradeReturnImportPlan,
  createCanvasProgressReturnImportPlan,
} from "../canvas-grade-progress-return";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-12T12:00:00.000Z";

function profile(selectionStatus: LmsSelectionStatus = "active"): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-canvas-return",
    institutionName: "Canvas Return Academy",
    legalName: "Canvas Return Academy",
    primaryMode: "college",
    lmsProvider: "canvas",
    now,
  });

  return {
    ...base,
    lmsPreference: {
      provider: "canvas",
      selectionStatus,
    },
  };
}

function resolvedProvider(selectionStatus: LmsSelectionStatus = "active", correlationId = "corr-canvas-return-1") {
  return resolveTenantLmsProvider(profile(selectionStatus), {
    tenantId: "tenant-canvas-return",
    correlationId,
  });
}

function returnConfig(overrides: Partial<CanvasReturnConfiguration> = {}): CanvasReturnConfiguration {
  return {
    tenantId: "tenant-canvas-return",
    importSourceLabel: "Canvas gradebook",
    ...overrides,
  };
}

function gradeBatch(overrides: Partial<LmsGradeReturnBatch> = {}): LmsGradeReturnBatch {
  const resolved = resolvedProvider();

  return {
    tenant: resolved.tenant,
    providerId: "canvas",
    courseId: "course-theo-201",
    sectionId: "section-theo-201-a",
    results: [
      {
        studentPersonId: "student-1",
        providerResultId: "canvas-grade-1",
        label: "Final grade",
        value: "A-",
        reviewStatus: "accepted_for_review",
      },
      {
        studentPersonId: "student-2",
        providerResultId: "canvas-grade-2",
        label: "Final grade",
        value: "B+",
        reviewStatus: "pending_review",
      },
    ],
    idempotencyKey: "idem-canvas-grade-return-1",
    ...overrides,
  };
}

function progressBatch(overrides: Partial<LmsProgressReturnBatch> = {}): LmsProgressReturnBatch {
  const resolved = resolvedProvider();

  return {
    tenant: resolved.tenant,
    providerId: "canvas",
    courseId: "course-theo-201",
    sectionId: "section-theo-201-a",
    results: [
      {
        studentPersonId: "student-1",
        providerProgressId: "canvas-progress-1",
        label: "Completion",
        summary: "90% complete",
        reviewStatus: "accepted_for_review",
      },
      {
        studentPersonId: "student-2",
        providerProgressId: "canvas-progress-2",
        label: "Completion",
        summary: "Needs faculty follow-up",
        reviewStatus: "pending_review",
      },
    ],
    idempotencyKey: "idem-canvas-progress-return-1",
    ...overrides,
  };
}

test("active Canvas grade return creates reviewed imports without official posting", () => {
  const resolved = resolvedProvider();
  const plan = createCanvasGradeReturnImportPlan({
    resolvedProvider: resolved,
    configuration: returnConfig({
      accessToken: "secret-token",
      rawProviderPayload: { canvasUserId: "canvas-user-1", gradeItem: "raw-grade" },
    }),
    batch: gradeBatch({ tenant: resolved.tenant }),
  });

  assert.equal(plan.result.status, "needs_review");
  assert.equal(plan.result.providerId, "canvas");
  assert.equal(plan.result.capability, "grade_return");
  assert.equal(plan.result.operationId, "idem-canvas-grade-return-1");
  assert.equal(plan.result.safeMessage, "Canvas grade return import is ready for Academy review.");
  assert.deepEqual(
    plan.reviewedImport?.results.map((result) => result.reviewStatus),
    ["pending_review", "pending_review"],
  );
  assert.deepEqual(plan.reviewedImport, {
    tenantId: "tenant-canvas-return",
    providerId: "canvas",
    courseId: "course-theo-201",
    sectionId: "section-theo-201-a",
    importSourceLabel: "Canvas gradebook",
    importKind: "grade_return",
    idempotencyKey: "idem-canvas-grade-return-1",
    results: [
      {
        studentPersonId: "student-1",
        providerResultId: "canvas-grade-1",
        label: "Final grade",
        value: "A-",
        reviewStatus: "pending_review",
      },
      {
        studentPersonId: "student-2",
        providerResultId: "canvas-grade-2",
        label: "Final grade",
        value: "B+",
        reviewStatus: "pending_review",
      },
    ],
  });
  assert.deepEqual(plan.auditEvent.redactedMetadata, {
    importSourceLabel: "Canvas gradebook",
    resultCount: 2,
    pendingReviewCount: 2,
  });
  assert.doesNotMatch(JSON.stringify(plan), /secret-token|canvas-user-1|raw-grade|accessToken|rawProviderPayload/i);
});

test("active Canvas progress return creates reviewed imports without Student PWA release", () => {
  const resolved = resolvedProvider("active", "corr-canvas-return-2");
  const plan = createCanvasProgressReturnImportPlan({
    resolvedProvider: resolved,
    configuration: returnConfig({
      accessToken: "secret-token",
      rawProviderPayload: { completionId: "raw-progress" },
    }),
    batch: progressBatch({ tenant: resolved.tenant }),
  });

  assert.equal(plan.result.status, "needs_review");
  assert.equal(plan.result.capability, "progress_return");
  assert.equal(plan.result.safeMessage, "Canvas progress return import is ready for Academy review.");
  assert.deepEqual(
    plan.reviewedImport?.results.map((result) => result.reviewStatus),
    ["pending_review", "pending_review"],
  );
  assert.deepEqual(plan.reviewedImport?.results[0], {
    studentPersonId: "student-1",
    providerProgressId: "canvas-progress-1",
    label: "Completion",
    summary: "90% complete",
    reviewStatus: "pending_review",
  });
  assert.deepEqual(plan.auditEvent.redactedMetadata, {
    importSourceLabel: "Canvas gradebook",
    resultCount: 2,
    pendingReviewCount: 2,
  });
  assert.doesNotMatch(JSON.stringify(plan), /secret-token|raw-progress|accessToken|rawProviderPayload/i);
});

test("Canvas grade and progress return are gated by tenant provider status", () => {
  for (const [selectionStatus, expectedMessage] of [
    ["planned", "Canvas is planned but not active for this tenant."],
    ["paused", "Canvas is paused for this tenant."],
    ["migration_required", "Canvas requires migration review before use."],
  ] as const) {
    const resolved = resolvedProvider(selectionStatus, `corr-canvas-return-${selectionStatus}`);
    const gradePlan = createCanvasGradeReturnImportPlan({
      resolvedProvider: resolved,
      configuration: returnConfig(),
      batch: gradeBatch({ tenant: resolved.tenant }),
    });
    const progressPlan = createCanvasProgressReturnImportPlan({
      resolvedProvider: resolved,
      configuration: returnConfig(),
      batch: progressBatch({ tenant: resolved.tenant }),
    });

    assert.equal(gradePlan.result.status, "unsupported");
    assert.equal(gradePlan.result.safeMessage, expectedMessage);
    assert.equal(gradePlan.reviewedImport, undefined);

    assert.equal(progressPlan.result.status, "unsupported");
    assert.equal(progressPlan.result.safeMessage, expectedMessage);
    assert.equal(progressPlan.reviewedImport, undefined);
  }
});

test("Canvas return import requires tenant-matched configuration and batches", () => {
  const resolved = resolvedProvider();

  assert.throws(
    () =>
      createCanvasGradeReturnImportPlan({
        resolvedProvider: resolved,
        configuration: returnConfig({ tenantId: "other-tenant" }),
        batch: gradeBatch({ tenant: resolved.tenant }),
      }),
    /Cannot create Canvas return import across tenants./,
  );

  assert.throws(
    () =>
      createCanvasProgressReturnImportPlan({
        resolvedProvider: resolved,
        configuration: returnConfig(),
        batch: progressBatch({
          tenant: {
            ...resolved.tenant,
            tenantId: "other-tenant",
          },
        }),
      }),
    /Cannot create Canvas return import across tenants./,
  );
});

test("Canvas return import requires idempotency keys before review imports are created", () => {
  const resolved = resolvedProvider();

  assert.throws(
    () =>
      createCanvasGradeReturnImportPlan({
        resolvedProvider: resolved,
        configuration: returnConfig(),
        batch: gradeBatch({ tenant: resolved.tenant, idempotencyKey: "" }),
      }),
    /Canvas return import requires an idempotency key./,
  );

  assert.throws(
    () =>
      createCanvasProgressReturnImportPlan({
        resolvedProvider: resolved,
        configuration: returnConfig(),
        batch: progressBatch({ tenant: resolved.tenant, idempotencyKey: "" }),
      }),
    /Canvas return import requires an idempotency key./,
  );
});
