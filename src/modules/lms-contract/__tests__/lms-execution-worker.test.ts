import assert from "node:assert/strict";
import test from "node:test";
import type { LmsAuditEvent } from "@/modules/lms-contract/contract";
import {
  executeLmsProviderOperations,
  type LmsExecutableProviderOperation,
} from "@/modules/lms-contract/lms-execution-worker";

const operation: LmsExecutableProviderOperation = {
  type: "upsert_course_shell",
  idempotencyKey: "idem-worker-1",
  stableCourseKey: "tenant-1:course-1",
};

const auditEvent: LmsAuditEvent = {
  tenantId: "tenant-1",
  providerId: "moodle",
  operation: "course_shell_provisioning",
  targetReferences: ["tenant-1:course-1"],
  correlationId: "corr-worker-1",
  resultStatus: "success",
  redactedMetadata: {},
};

test("executes provider operations sequentially and returns a safe success result", async () => {
  const calls: string[] = [];
  const result = await executeLmsProviderOperations({
    tenantId: "tenant-1",
    providerId: "moodle",
    capability: "course_shell_provisioning",
    correlationId: "corr-worker-1",
    operations: [operation],
    auditEvent,
    executor: {
      execute: async (nextOperation) => {
        calls.push(nextOperation.idempotencyKey);
        return {
          status: "success",
          providerReference: "provider-course-1",
          safeMessage: "Course shell provisioned.",
        };
      },
    },
  });

  assert.deepEqual(calls, ["idem-worker-1"]);
  assert.equal(result.result.status, "success");
  assert.equal(result.result.retryable, false);
  assert.equal(result.executions[0]?.providerReference, "provider-course-1");
  assert.doesNotMatch(JSON.stringify(result), /accessToken|clientSecret|rawProviderPayload/i);
});

test("suppresses duplicate provider execution by tenant/provider/capability/idempotency key", async () => {
  let called = false;
  const result = await executeLmsProviderOperations({
    tenantId: "tenant-1",
    providerId: "canvas",
    capability: "roster_sync",
    correlationId: "corr-worker-2",
    operations: [{ type: "sync_roster_membership", idempotencyKey: "idem-roster-1", stableSectionKey: "tenant-1:section-1", memberships: [] }],
    auditEvent: { ...auditEvent, providerId: "canvas", operation: "roster_sync", correlationId: "corr-worker-2" },
    completedOperationKeys: new Set(["tenant-1:canvas:roster_sync:idem-roster-1"]),
    executor: {
      execute: async () => {
        called = true;
        return { status: "success", safeMessage: "Should not run." };
      },
    },
  });

  assert.equal(called, false);
  assert.equal(result.result.status, "success");
  assert.equal(result.executions[0]?.status, "success");
  assert.equal(result.executions[0]?.safeMessage, "Duplicate operation replay suppressed.");
});

test("marks retryable provider failures without exposing raw errors", async () => {
  const result = await executeLmsProviderOperations({
    tenantId: "tenant-1",
    providerId: "moodle",
    capability: "roster_sync",
    correlationId: "corr-worker-3",
    operations: [{ type: "sync_roster_membership", idempotencyKey: "idem-roster-2", stableSectionKey: "tenant-1:section-1", memberships: [] }],
    auditEvent: { ...auditEvent, operation: "roster_sync", correlationId: "corr-worker-3" },
    executor: {
      execute: async () => ({
        status: "retryable_failure",
        safeMessage: "Provider temporarily unavailable.",
        retryAfterSeconds: 60,
      }),
    },
  });

  assert.equal(result.result.status, "retryable_failure");
  assert.equal(result.result.retryable, true);
  assert.equal(result.executions[0]?.retryAfterSeconds, 60);
  assert.doesNotMatch(JSON.stringify(result), /stack|password|token|raw/i);
});
