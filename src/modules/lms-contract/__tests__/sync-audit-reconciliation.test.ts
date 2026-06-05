import assert from "node:assert/strict";
import test from "node:test";
import { LmsWebhookEnvelope, createEmptyLmsReconciliationReport } from "../contract";
import {
  buildLmsOperationIdempotencyKey,
  createLmsAuditEvent,
  isDuplicateLmsWebhookEvent,
  summarizeLmsReconciliationReport,
} from "../sync-audit-reconciliation";

const webhook: LmsWebhookEnvelope = {
  tenantId: "tenant-sync",
  providerId: "moodle",
  providerEventId: "evt-001",
  receivedAt: "2026-06-04T12:00:00.000Z",
  signatureStatus: "verified",
  normalizedEventType: "grade_returned",
};

test("sync audit events are tenant scoped and redact provider secrets", () => {
  const event = createLmsAuditEvent({
    tenantId: "tenant-sync",
    providerId: "moodle",
    operation: "grade_return",
    actorPersonId: "registrar-1",
    targetReferences: ["section-1", "student-1"],
    correlationId: "corr-sync-1",
    resultStatus: "needs_review",
    metadata: {
      providerBatchId: "batch-1",
      acceptedCount: 2,
      dryRun: false,
      accessToken: "never-return",
      webhookSecret: "never-return",
      rawProviderPayload: { grade: "A", token: "never-return" },
    },
  });

  assert.deepEqual(event, {
    tenantId: "tenant-sync",
    providerId: "moodle",
    operation: "grade_return",
    actorPersonId: "registrar-1",
    targetReferences: ["section-1", "student-1"],
    correlationId: "corr-sync-1",
    resultStatus: "needs_review",
    redactedMetadata: {
      providerBatchId: "batch-1",
      acceptedCount: 2,
      dryRun: false,
    },
  });
  assert.doesNotMatch(JSON.stringify(event), /never-return|rawProviderPayload|accessToken|webhookSecret/i);
});

test("sync audit events reject cross-tenant target references before event creation", () => {
  assert.throws(
    () =>
      createLmsAuditEvent({
        tenantId: "tenant-sync",
        providerId: "canvas",
        operation: "roster_sync",
        targetReferences: ["tenant-other:section-1"],
        correlationId: "corr-sync-2",
        resultStatus: "conflict",
        metadata: {},
      }),
    /Cross-tenant LMS audit target reference denied./,
  );
});

test("operation idempotency keys are tenant provider and operation scoped", () => {
  assert.equal(
    buildLmsOperationIdempotencyKey({
      tenantId: "tenant-sync",
      providerId: "canvas",
      capability: "roster_sync",
      operationId: "op-123",
    }),
    "tenant-sync:canvas:roster_sync:op-123",
  );
});

test("webhook duplicate detection is tenant and provider scoped", () => {
  assert.equal(isDuplicateLmsWebhookEvent(webhook, new Set()), false);
  assert.equal(isDuplicateLmsWebhookEvent(webhook, new Set(["tenant-sync:moodle:evt-001"])), true);
  assert.equal(isDuplicateLmsWebhookEvent(webhook, new Set(["tenant-sync:canvas:evt-001"])), false);
});

test("reconciliation summaries count drift categories and required actions", () => {
  const report = {
    ...createEmptyLmsReconciliationReport("tenant-sync", "moodle", "corr-sync-3"),
    missingMappings: ["section-1"],
    staleMappings: ["section-2", "section-3"],
    rosterDrift: ["student-1"],
    gradeReturnDrift: ["grade-1"],
    requiredActions: ["Review section mapping", "Review grade return"],
  };

  assert.deepEqual(summarizeLmsReconciliationReport(report), {
    tenantId: "tenant-sync",
    providerId: "moodle",
    correlationId: "corr-sync-3",
    status: "needs_action",
    driftCount: 5,
    requiredActionCount: 2,
  });
});

test("clean reconciliation summaries report no action required", () => {
  assert.deepEqual(summarizeLmsReconciliationReport(createEmptyLmsReconciliationReport("tenant-sync", "none", "corr-sync-4")), {
    tenantId: "tenant-sync",
    providerId: "none",
    correlationId: "corr-sync-4",
    status: "clean",
    driftCount: 0,
    requiredActionCount: 0,
  });
});
