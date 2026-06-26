import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { LmsAuditEvent } from "@/modules/lms-contract/contract";
import {
  createInMemoryLmsOperationJobRepository,
  enqueueLmsOperation,
  executeLmsProviderOperations,
  markProviderCircuitOpen,
  resetProviderCircuitAfterSuccess,
  runDueLmsOperations,
  runNextLmsOperation,
  type LmsExecutableProviderOperation,
} from "@/modules/lms-contract/lms-execution-worker";
import type { OperationalEvent } from "@/modules/observability/operational-events";

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
  const events: OperationalEvent[] = [];
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
    emitEvent: (event) => events.push(event),
  });

  assert.equal(result.result.status, "retryable_failure");
  assert.equal(result.result.retryable, true);
  assert.equal(result.executions[0]?.retryAfterSeconds, 60);
  assert.doesNotMatch(JSON.stringify(result), /stack|password|token|raw/i);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.category, "provider_worker_failure");
  assert.equal(events[0]?.tenantId, "tenant-1");
  assert.equal(events[0]?.metadata.providerId, "moodle");
  assert.doesNotMatch(JSON.stringify(events[0]), /stack|password|token|raw/i);
});

test("durable worker suppresses duplicate jobs by tenant/provider/family/idempotency key", async () => {
  const repository = createInMemoryLmsOperationJobRepository();
  const first = await enqueueLmsOperation(repository, {
    tenantId: "tenant-1",
    providerId: "moodle",
    operationFamily: "course_shell_provisioning",
    payload: operation,
    idempotencyKey: "idem-durable-1",
    requestedByActor: "person-admin",
    correlationId: "corr-durable-1",
  });
  const duplicate = await enqueueLmsOperation(repository, {
    tenantId: "tenant-1",
    providerId: "moodle",
    operationFamily: "course_shell_provisioning",
    payload: { ...operation, stableCourseKey: "tenant-1:course-duplicate" },
    idempotencyKey: "idem-durable-1",
    requestedByActor: "person-admin",
    correlationId: "corr-durable-duplicate",
  });

  const calls: string[] = [];
  await runDueLmsOperations(
    {
      tenantId: "tenant-1",
      repository,
      executor: {
        execute: async (nextOperation) => {
          calls.push(nextOperation.idempotencyKey);
          return { status: "success", safeMessage: "Course shell provisioned." };
        },
      },
    },
    5,
  );

  assert.equal(duplicate.id, first.id);
  assert.deepEqual(calls, ["idem-worker-1"]);
  assert.equal((await repository.getById(first.id))?.status, "succeeded");
});

test("durable worker retries until exhaustion and stores only redacted last error", async () => {
  const repository = createInMemoryLmsOperationJobRepository();
  const events: OperationalEvent[] = [];
  const audits: LmsAuditEvent[] = [];
  const job = await enqueueLmsOperation(repository, {
    tenantId: "tenant-1",
    providerId: "canvas",
    operationFamily: "roster_sync",
    payload: {
      type: "sync_roster_membership",
      idempotencyKey: "idem-retry-1",
      accessToken: "sk_live_secret_token",
      rawProviderPayload: { password: "super-secret" },
    },
    idempotencyKey: "idem-retry-1",
    requestedByActor: "system:lms-worker",
    correlationId: "corr-retry-1",
    maxAttempts: 2,
  });

  await runDueLmsOperations(
    {
      tenantId: "tenant-1",
      repository,
      emitEvent: (event) => events.push(event),
      auditSink: (event) => audits.push(event),
      executor: {
        execute: async () => ({
          status: "retryable_failure",
          safeMessage: "Canvas timeout for accessToken=sk_live_secret_token rawProviderPayload.password=super-secret",
          retryAfterSeconds: 0,
        }),
      },
    },
    1,
  );
  await runDueLmsOperations(
    {
      tenantId: "tenant-1",
      repository,
      emitEvent: (event) => events.push(event),
      auditSink: (event) => audits.push(event),
      executor: {
        execute: async () => ({
          status: "retryable_failure",
          safeMessage: "Canvas timeout for accessToken=sk_live_secret_token rawProviderPayload.password=super-secret",
          retryAfterSeconds: 0,
        }),
      },
    },
    1,
  );

  const updated = await repository.getById(job.id);
  assert.equal(updated?.status, "failed");
  assert.equal(updated?.attempts, 2);
  assert.doesNotMatch(JSON.stringify(updated), /sk_live_secret_token|super-secret|rawProviderPayload|password/i);
  assert.doesNotMatch(JSON.stringify(events), /sk_live_secret_token|super-secret|rawProviderPayload|password/i);
  assert.doesNotMatch(JSON.stringify(audits), /sk_live_secret_token|super-secret|rawProviderPayload|password/i);
});

test("durable worker skips provider calls while tenant provider circuit is open", async () => {
  const repository = createInMemoryLmsOperationJobRepository();
  const audits: LmsAuditEvent[] = [];
  const job = await enqueueLmsOperation(repository, {
    tenantId: "tenant-1",
    providerId: "moodle",
    operationFamily: "grade_return",
    payload: { type: "import_grade_return", idempotencyKey: "idem-circuit-1" },
    idempotencyKey: "idem-circuit-1",
    requestedByActor: "system:lms-worker",
    correlationId: "corr-circuit-1",
  });

  let called = false;
  const result = await runNextLmsOperation({
    tenantId: "tenant-1",
    repository,
    isProviderCircuitOpen: async () => true,
    auditSink: (event) => audits.push(event),
    emitEvent: () => undefined,
    executor: {
      execute: async () => {
        called = true;
        return { status: "success", safeMessage: "Should not call provider." };
      },
    },
  });

  assert.equal(called, false);
  assert.equal(result?.status, "blocked_by_circuit");
  assert.equal((await repository.getById(job.id))?.status, "blocked_by_circuit");
  assert.equal(audits[0]?.redactedMetadata.circuitOpen, true);
  assert.doesNotMatch(JSON.stringify(audits), /token|secret|rawProviderPayload/i);
});

test("durable worker resets provider circuit after success", async () => {
  const repository = createInMemoryLmsOperationJobRepository();
  await enqueueLmsOperation(repository, {
    tenantId: "tenant-1",
    providerId: "canvas",
    operationFamily: "progress_return",
    payload: { type: "import_progress_return", idempotencyKey: "idem-success-1" },
    idempotencyKey: "idem-success-1",
    requestedByActor: "system:lms-worker",
    correlationId: "corr-success-1",
  });

  const resetCalls: string[] = [];
  const result = await runNextLmsOperation({
    tenantId: "tenant-1",
    repository,
    resetCircuitAfterSuccess: async (tenantId, providerId) => {
      resetCalls.push(`${tenantId}:${providerId}`);
    },
    emitEvent: () => undefined,
    executor: {
      execute: async () => ({ status: "success", safeMessage: "Progress imported for review." }),
    },
  });

  assert.equal(result?.status, "succeeded");
  assert.deepEqual(resetCalls, ["tenant-1:canvas"]);
});

test("circuit open helper emits admin notification and safe operational event", async () => {
  const notifications: Array<{ tenantId: string; providerId: string; reason: string }> = [];
  const events: OperationalEvent[] = [];

  await markProviderCircuitOpen("tenant-1", "moodle", "token=sk_live_secret rawProviderPayload password=hidden", {
    notifyAdministrators: async (notification) => notifications.push(notification),
    emitEvent: (event) => events.push(event),
  });

  assert.deepEqual(notifications, [
    {
      tenantId: "tenant-1",
      providerId: "moodle",
      reason: "[redacted]",
    },
  ]);
  assert.equal(events[0]?.category, "provider_worker_failure");
  assert.doesNotMatch(JSON.stringify({ notifications, events }), /sk_live_secret|password|rawProviderPayload/i);
});

test("reset helper delegates tenant/provider circuit reset", async () => {
  const calls: string[] = [];

  await resetProviderCircuitAfterSuccess("tenant-1", "canvas", {
    resetCircuit: async (tenantId, providerId) => calls.push(`${tenantId}:${providerId}`),
    emitEvent: () => undefined,
  });

  assert.deepEqual(calls, ["tenant-1:canvas"]);
});

test("durable worker rejects cross-tenant execution before provider calls", async () => {
  const repository = createInMemoryLmsOperationJobRepository();
  const job = await enqueueLmsOperation(repository, {
    tenantId: "tenant-2",
    providerId: "moodle",
    operationFamily: "roster_sync",
    payload: { type: "sync_roster_membership", idempotencyKey: "idem-cross-tenant" },
    idempotencyKey: "idem-cross-tenant",
    requestedByActor: "system:lms-worker",
    correlationId: "corr-cross-tenant",
  });

  await assert.rejects(
    runNextLmsOperation({
      tenantId: "tenant-1",
      repository,
      executor: {
        execute: async () => {
          throw new Error("provider should not be called");
        },
      },
    }),
    /Cross-tenant LMS job execution rejected/,
  );
  assert.equal((await repository.getById(job.id))?.status, "queued");
});

test("durable LMS operation migration defines idempotent queued job storage", () => {
  const migration = readFileSync("supabase/migrations/20260626030000_lms_operation_jobs.sql", "utf8");

  assert.match(migration, /create table if not exists public\.lms_operation_jobs/);
  assert.match(migration, /tenant_id text not null/);
  assert.match(migration, /provider_id text not null/);
  assert.match(migration, /operation_family text not null/);
  assert.match(migration, /payload jsonb not null/);
  assert.match(migration, /idempotency_key text not null/);
  assert.match(migration, /requested_by_actor text not null/);
  assert.match(migration, /correlation_id text not null/);
  assert.match(migration, /attempts int not null default 0/);
  assert.match(migration, /unique \(tenant_id, provider_id, operation_family, idempotency_key\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.doesNotMatch(migration, /access_token|refresh_token|client_secret|raw_provider_payload|password/i);
});
