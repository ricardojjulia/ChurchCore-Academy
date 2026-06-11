import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile, LmsSelectionStatus } from "@/modules/academy-config/types";
import { LmsGradeReturnBatch, LmsProgressReturnBatch } from "../contract";
import {
  createMoodleGradeReturnImportPlan,
  createMoodleProgressReturnImportPlan,
  MoodleReturnConfiguration,
} from "../moodle-grade-progress-return";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-04T12:00:00.000Z";

function profile(selectionStatus: LmsSelectionStatus = "active"): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-moodle-return",
    institutionName: "Moodle Return Academy",
    legalName: "Moodle Return Academy",
    primaryMode: "college",
    lmsProvider: "moodle",
    now,
  });

  return {
    ...base,
    lmsPreference: {
      provider: "moodle",
      selectionStatus,
    },
  };
}

function resolvedProvider(selectionStatus: LmsSelectionStatus = "active", correlationId = "corr-moodle-return-1") {
  return resolveTenantLmsProvider(profile(selectionStatus), {
    tenantId: "tenant-moodle-return",
    correlationId,
  });
}

function returnConfig(overrides: Partial<MoodleReturnConfiguration> = {}): MoodleReturnConfiguration {
  return {
    tenantId: "tenant-moodle-return",
    importSourceLabel: "Moodle gradebook",
    ...overrides,
  };
}

function gradeBatch(overrides: Partial<LmsGradeReturnBatch> = {}): LmsGradeReturnBatch {
  const resolved = resolvedProvider();

  return {
    tenant: resolved.tenant,
    providerId: "moodle",
    courseId: "course-bibl-101",
    sectionId: "section-bibl-101-a",
    results: [
      {
        studentPersonId: "student-1",
        providerResultId: "moodle-grade-1",
        label: "Final grade",
        value: "A",
        reviewStatus: "accepted_for_review",
      },
      {
        studentPersonId: "student-2",
        providerResultId: "moodle-grade-2",
        label: "Final grade",
        value: "B",
        reviewStatus: "pending_review",
      },
    ],
    idempotencyKey: "idem-grade-return-1",
    ...overrides,
  };
}

function progressBatch(overrides: Partial<LmsProgressReturnBatch> = {}): LmsProgressReturnBatch {
  const resolved = resolvedProvider();

  return {
    tenant: resolved.tenant,
    providerId: "moodle",
    courseId: "course-bibl-101",
    sectionId: "section-bibl-101-a",
    results: [
      {
        studentPersonId: "student-1",
        providerProgressId: "moodle-progress-1",
        label: "Completion",
        summary: "85% complete",
        reviewStatus: "accepted_for_review",
      },
      {
        studentPersonId: "student-2",
        providerProgressId: "moodle-progress-2",
        label: "Completion",
        summary: "Needs instructor review",
        reviewStatus: "pending_review",
      },
    ],
    idempotencyKey: "idem-progress-return-1",
    ...overrides,
  };
}

test("active Moodle grade return creates reviewed imports without official posting", () => {
  const resolved = resolvedProvider();
  const plan = createMoodleGradeReturnImportPlan({
    resolvedProvider: resolved,
    configuration: returnConfig({
      accessToken: "secret-token",
      rawProviderPayload: { moodleUserId: "mdl-user-1", gradeItem: "raw-grade" },
    }),
    batch: gradeBatch({ tenant: resolved.tenant }),
  });

  assert.equal(plan.result.status, "needs_review");
  assert.equal(plan.result.providerId, "moodle");
  assert.equal(plan.result.capability, "grade_return");
  assert.equal(plan.result.operationId, "idem-grade-return-1");
  assert.equal(plan.result.safeMessage, "Moodle grade return import is ready for Academy review.");
  assert.deepEqual(
    plan.reviewedImport.results.map((result) => result.reviewStatus),
    ["pending_review", "pending_review"],
  );
  assert.deepEqual(plan.reviewedImport, {
    tenantId: "tenant-moodle-return",
    providerId: "moodle",
    courseId: "course-bibl-101",
    sectionId: "section-bibl-101-a",
    importSourceLabel: "Moodle gradebook",
    importKind: "grade_return",
    idempotencyKey: "idem-grade-return-1",
    results: [
      {
        studentPersonId: "student-1",
        providerResultId: "moodle-grade-1",
        label: "Final grade",
        value: "A",
        reviewStatus: "pending_review",
      },
      {
        studentPersonId: "student-2",
        providerResultId: "moodle-grade-2",
        label: "Final grade",
        value: "B",
        reviewStatus: "pending_review",
      },
    ],
  });
  assert.deepEqual(plan.auditEvent.redactedMetadata, {
    importSourceLabel: "Moodle gradebook",
    resultCount: 2,
    pendingReviewCount: 2,
  });
  assert.doesNotMatch(JSON.stringify(plan), /secret-token|mdl-user-1|raw-grade|accessToken|rawProviderPayload/i);
});

test("active Moodle progress return creates reviewed imports without Student PWA release", () => {
  const resolved = resolvedProvider("active", "corr-moodle-return-2");
  const plan = createMoodleProgressReturnImportPlan({
    resolvedProvider: resolved,
    configuration: returnConfig({
      accessToken: "secret-token",
      rawProviderPayload: { completionId: "raw-progress" },
    }),
    batch: progressBatch({ tenant: resolved.tenant }),
  });

  assert.equal(plan.result.status, "needs_review");
  assert.equal(plan.result.capability, "progress_return");
  assert.equal(plan.result.safeMessage, "Moodle progress return import is ready for Academy review.");
  assert.deepEqual(
    plan.reviewedImport.results.map((result) => result.reviewStatus),
    ["pending_review", "pending_review"],
  );
  assert.deepEqual(plan.reviewedImport.results[0], {
    studentPersonId: "student-1",
    providerProgressId: "moodle-progress-1",
    label: "Completion",
    summary: "85% complete",
    reviewStatus: "pending_review",
  });
  assert.deepEqual(plan.auditEvent.redactedMetadata, {
    importSourceLabel: "Moodle gradebook",
    resultCount: 2,
    pendingReviewCount: 2,
  });
  assert.doesNotMatch(JSON.stringify(plan), /secret-token|raw-progress|accessToken|rawProviderPayload/i);
});

test("Moodle grade and progress return are gated by tenant provider status", () => {
  for (const [selectionStatus, expectedMessage] of [
    ["planned", "Moodle is planned but not active for this tenant."],
    ["paused", "Moodle is paused for this tenant."],
    ["migration_required", "Moodle requires migration review before use."],
  ] as const) {
    const resolved = resolvedProvider(selectionStatus, `corr-moodle-return-${selectionStatus}`);
    const gradePlan = createMoodleGradeReturnImportPlan({
      resolvedProvider: resolved,
      configuration: returnConfig(),
      batch: gradeBatch({ tenant: resolved.tenant }),
    });
    const progressPlan = createMoodleProgressReturnImportPlan({
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

test("Moodle return import requires tenant-matched configuration and batches", () => {
  const resolved = resolvedProvider();

  assert.throws(
    () =>
      createMoodleGradeReturnImportPlan({
        resolvedProvider: resolved,
        configuration: returnConfig({ tenantId: "other-tenant" }),
        batch: gradeBatch({ tenant: resolved.tenant }),
      }),
    /Cannot create Moodle return import across tenants./,
  );

  assert.throws(
    () =>
      createMoodleProgressReturnImportPlan({
        resolvedProvider: resolved,
        configuration: returnConfig(),
        batch: progressBatch({
          tenant: {
            ...resolved.tenant,
            tenantId: "other-tenant",
          },
        }),
      }),
    /Cannot create Moodle return import across tenants./,
  );
});

test("Moodle return import requires idempotency keys before review imports are created", () => {
  const resolved = resolvedProvider();

  assert.throws(
    () =>
      createMoodleGradeReturnImportPlan({
        resolvedProvider: resolved,
        configuration: returnConfig(),
        batch: gradeBatch({ tenant: resolved.tenant, idempotencyKey: "" }),
      }),
    /Moodle return import requires an idempotency key./,
  );

  assert.throws(
    () =>
      createMoodleProgressReturnImportPlan({
        resolvedProvider: resolved,
        configuration: returnConfig(),
        batch: progressBatch({ tenant: resolved.tenant, idempotencyKey: "" }),
      }),
    /Moodle return import requires an idempotency key./,
  );
});
