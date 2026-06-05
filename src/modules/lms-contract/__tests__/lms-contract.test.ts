import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLmsWebhookDedupeKey,
  createEmptyLmsReconciliationReport,
  createUnsupportedLmsOperationResult,
  lmsProviderDescriptors,
  lmsProviderSecretFieldNames,
  lmsReviewedImportStatuses,
  lmsSensitiveLaunchFieldNames,
  providerSupportsLmsCapability,
  requiresLmsIdempotencyKey,
  validateLmsLaunchResponseSafety,
} from "../contract";

test("provider descriptors expose a provider-neutral capability matrix", () => {
  assert.deepEqual(
    lmsProviderDescriptors.map((descriptor) => descriptor.id),
    ["none", "moodle", "canvas"],
  );

  const noLms = lmsProviderDescriptors.find((descriptor) => descriptor.id === "none");
  assert.ok(noLms);
  assert.equal(noLms.displayName, "No LMS");
  assert.deepEqual(noLms.capabilities, []);
  assert.equal(providerSupportsLmsCapability(noLms, "identity_launch"), false);

  const moodle = lmsProviderDescriptors.find((descriptor) => descriptor.id === "moodle");
  const canvas = lmsProviderDescriptors.find((descriptor) => descriptor.id === "canvas");
  assert.equal(providerSupportsLmsCapability(moodle!, "identity_launch"), true);
  assert.equal(providerSupportsLmsCapability(canvas!, "roster_sync"), true);
});

test("no-LMS unsupported outcomes are explicit and audit-ready", () => {
  const result = createUnsupportedLmsOperationResult({
    providerId: "none",
    capability: "identity_launch",
    tenantId: "tenant-lms",
    correlationId: "corr-001",
    operationId: "op-001",
    safeMessage: "This institution has not enabled an external LMS.",
  });

  assert.deepEqual(result, {
    status: "unsupported",
    providerId: "none",
    capability: "identity_launch",
    tenantId: "tenant-lms",
    correlationId: "corr-001",
    operationId: "op-001",
    retryable: false,
    safeMessage: "This institution has not enabled an external LMS.",
  });
});

test("launch response safety rejects provider secrets and raw provider payloads", () => {
  const safeResponse = {
    status: "unavailable",
    displayLabel: "Learning",
    unavailableReason: "This institution has not enabled an external LMS.",
    auditReference: "audit-001",
  } as const;

  assert.deepEqual(validateLmsLaunchResponseSafety(safeResponse), []);
  assert.ok(lmsSensitiveLaunchFieldNames.includes("accessToken"));
  assert.ok(lmsProviderSecretFieldNames.includes("webhookSecret"));

  const unsafeResponse = {
    status: "available",
    displayLabel: "Learning",
    launchUrl: "https://lms.example/launch",
    accessToken: "secret-token",
    rawProviderPayload: { user: "external-student" },
  };

  assert.deepEqual(validateLmsLaunchResponseSafety(unsafeResponse), [
    "accessToken",
    "rawProviderPayload",
  ]);
});

test("mutating and import operations require idempotency keys", () => {
  assert.equal(requiresLmsIdempotencyKey("identity_launch"), false);
  assert.equal(requiresLmsIdempotencyKey("course_shell_provisioning"), true);
  assert.equal(requiresLmsIdempotencyKey("roster_sync"), true);
  assert.equal(requiresLmsIdempotencyKey("grade_return"), true);
  assert.equal(requiresLmsIdempotencyKey("progress_return"), true);
  assert.equal(requiresLmsIdempotencyKey("webhooks"), true);
});

test("webhook dedupe keys are tenant and provider scoped", () => {
  assert.equal(
    buildLmsWebhookDedupeKey({
      tenantId: "tenant-lms",
      providerId: "moodle",
      providerEventId: "evt-123",
    }),
    "tenant-lms:moodle:evt-123",
  );
});

test("grade and progress return statuses stay in reviewed-import workflow states", () => {
  assert.deepEqual(lmsReviewedImportStatuses, [
    "pending_review",
    "accepted_for_review",
    "rejected",
    "superseded",
  ]);
});

test("empty reconciliation reports use the contract drift categories", () => {
  assert.deepEqual(createEmptyLmsReconciliationReport("tenant-lms", "canvas", "corr-002"), {
    tenantId: "tenant-lms",
    providerId: "canvas",
    correlationId: "corr-002",
    missingMappings: [],
    staleMappings: [],
    duplicateProviderObjects: [],
    rosterDrift: [],
    enrollmentDrift: [],
    gradeReturnDrift: [],
    progressReturnDrift: [],
    capabilityMismatches: [],
    requiredActions: [],
  });
});
