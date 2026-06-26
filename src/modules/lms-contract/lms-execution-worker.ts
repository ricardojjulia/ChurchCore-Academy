import {
  type LmsCapability,
  type LmsOperationResult,
  type LmsOperationStatus,
  type LmsProviderId,
  type LmsAuditEvent,
} from "@/modules/lms-contract/contract";
import { buildLmsOperationIdempotencyKey } from "@/modules/lms-contract/sync-audit-reconciliation";
import {
  emitOperationalEvent,
  type OperationalEventSink,
} from "@/modules/observability/operational-events";

type LiveLmsProviderId = Exclude<LmsProviderId, "none">;

export type LmsExecutableProviderOperation = {
  type: string;
  idempotencyKey: string;
  [key: string]: unknown;
};

export interface LmsProviderOperationExecution {
  status: Extract<LmsOperationStatus, "success" | "retryable_failure" | "permanent_failure" | "conflict">;
  safeMessage: string;
  providerReference?: string;
  retryAfterSeconds?: number;
}

export interface LmsProviderOperationExecutor {
  execute(operation: LmsExecutableProviderOperation): Promise<LmsProviderOperationExecution>;
}

export interface ExecuteLmsProviderOperationsInput {
  tenantId: string;
  providerId: LiveLmsProviderId;
  capability: LmsCapability;
  correlationId: string;
  operations: LmsExecutableProviderOperation[];
  auditEvent?: LmsAuditEvent;
  executor: LmsProviderOperationExecutor;
  completedOperationKeys?: ReadonlySet<string>;
  emitEvent?: OperationalEventSink;
}

export interface ExecutedLmsProviderOperation extends LmsProviderOperationExecution {
  operationType: string;
  operationKey: string;
}

export interface ExecutedLmsProviderOperations {
  result: LmsOperationResult;
  auditEvent?: LmsAuditEvent;
  executions: ExecutedLmsProviderOperation[];
}

export type LmsOperationJobStatus =
  | "queued"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "blocked_by_circuit";

export interface LmsOperationJob {
  id: string;
  tenantId: string;
  providerId: LiveLmsProviderId;
  operationFamily: LmsCapability;
  payload: LmsExecutableProviderOperation;
  idempotencyKey: string;
  requestedByActor: string;
  correlationId: string;
  status: LmsOperationJobStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  providerReference?: string;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueLmsOperationInput {
  tenantId: string;
  providerId: LiveLmsProviderId;
  operationFamily: LmsCapability;
  payload: LmsExecutableProviderOperation;
  idempotencyKey: string;
  requestedByActor: string;
  correlationId: string;
  maxAttempts?: number;
  now?: Date;
}

export interface LmsOperationJobRepository {
  enqueue(input: EnqueueLmsOperationInput): Promise<LmsOperationJob>;
  claimNextDue(now: Date): Promise<LmsOperationJob | undefined>;
  save(job: LmsOperationJob): Promise<LmsOperationJob>;
  getById(id: string): Promise<LmsOperationJob | undefined>;
}

export type LmsAuditEventSink = (event: LmsAuditEvent) => void | Promise<void>;

export interface LmsExecutionWorkerContext {
  tenantId: string;
  repository: LmsOperationJobRepository;
  executor: LmsProviderOperationExecutor;
  now?: () => Date;
  isProviderCircuitOpen?: (tenantId: string, providerId: LiveLmsProviderId) => Promise<boolean>;
  resetCircuitAfterSuccess?: (tenantId: string, providerId: LiveLmsProviderId) => Promise<void>;
  auditSink?: LmsAuditEventSink;
  emitEvent?: OperationalEventSink;
}

export interface ProviderCircuitNotification {
  tenantId: string;
  providerId: LiveLmsProviderId;
  reason: string;
}

export interface ProviderCircuitOpenOptions {
  notifyAdministrators?: (notification: ProviderCircuitNotification) => Promise<void>;
  emitEvent?: OperationalEventSink;
}

export interface ProviderCircuitResetOptions {
  resetCircuit?: (tenantId: string, providerId: LiveLmsProviderId) => Promise<void>;
  emitEvent?: OperationalEventSink;
}

const SECRET_FIELD_PATTERN = /(access|refresh)?token|secret|password|credential|signature|rawproviderpayload|raw_provider_payload|api[_-]?key/i;
const SECRET_VALUE_PATTERN =
  /(accessToken|refreshToken|clientSecret|rawProviderPayload|password|token|secret|api[_-]?key)\s*[:=][^\s,;]+|sk_(live|test)_[A-Za-z0-9_]+/i;

function redactText(value: string) {
  return SECRET_VALUE_PATTERN.test(value) ? "[redacted]" : value;
}

function redactPayload(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactPayload(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_FIELD_PATTERN.test(key))
      .map(([key, entryValue]) => [key, redactPayload(entryValue)]),
  );
}

function sanitizeOperationPayload(payload: LmsExecutableProviderOperation): LmsExecutableProviderOperation {
  return redactPayload(payload) as LmsExecutableProviderOperation;
}

function nowIso(now: Date) {
  return now.toISOString();
}

function buildJobIdentity(input: EnqueueLmsOperationInput) {
  return `${input.tenantId}:${input.providerId}:${input.operationFamily}:${input.idempotencyKey}`;
}

function buildAuditEvent(
  job: LmsOperationJob,
  resultStatus: LmsOperationStatus,
  metadata: Record<string, string | number | boolean>,
): LmsAuditEvent {
  return {
    tenantId: job.tenantId,
    providerId: job.providerId,
    operation: job.operationFamily,
    actorPersonId: job.requestedByActor,
    targetReferences: [job.id],
    correlationId: job.correlationId,
    resultStatus,
    redactedMetadata: metadata,
  };
}

function cloneJob(job: LmsOperationJob): LmsOperationJob {
  return {
    ...job,
    payload: { ...job.payload },
  };
}

export function createInMemoryLmsOperationJobRepository(): LmsOperationJobRepository {
  const jobs = new Map<string, LmsOperationJob>();
  const identityToId = new Map<string, string>();
  let sequence = 0;

  return {
    async enqueue(input) {
      const identity = buildJobIdentity(input);
      const existingId = identityToId.get(identity);
      if (existingId) {
        const existing = jobs.get(existingId);
        if (existing) return cloneJob(existing);
      }

      sequence += 1;
      const now = input.now ?? new Date();
      const timestamp = nowIso(now);
      const job: LmsOperationJob = {
        id: `lms-job-${sequence}`,
        tenantId: input.tenantId,
        providerId: input.providerId,
        operationFamily: input.operationFamily,
        payload: sanitizeOperationPayload(input.payload),
        idempotencyKey: input.idempotencyKey,
        requestedByActor: input.requestedByActor,
        correlationId: input.correlationId,
        status: "queued",
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 3,
        nextRunAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      jobs.set(job.id, job);
      identityToId.set(identity, job.id);
      return cloneJob(job);
    },
    async claimNextDue(now) {
      const timestamp = now.getTime();
      const due = [...jobs.values()]
        .filter((job) => ["queued", "retrying"].includes(job.status) && Date.parse(job.nextRunAt) <= timestamp)
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))[0];

      if (!due) return undefined;
      due.status = "running";
      due.updatedAt = nowIso(now);
      jobs.set(due.id, due);
      return cloneJob(due);
    },
    async save(job) {
      jobs.set(job.id, cloneJob(job));
      return cloneJob(job);
    },
    async getById(id) {
      const job = jobs.get(id);
      return job ? cloneJob(job) : undefined;
    },
  };
}

export async function enqueueLmsOperation(
  repository: LmsOperationJobRepository,
  input: EnqueueLmsOperationInput,
): Promise<LmsOperationJob> {
  return repository.enqueue(input);
}

async function emitAudit(input: LmsExecutionWorkerContext, event: LmsAuditEvent) {
  await input.auditSink?.(event);
}

async function completeCircuitBlockedJob(input: LmsExecutionWorkerContext, job: LmsOperationJob, now: Date) {
  const updated: LmsOperationJob = {
    ...job,
    status: "blocked_by_circuit",
    lastError: "Provider circuit is open.",
    updatedAt: nowIso(now),
  };

  await emitAudit(
    input,
    buildAuditEvent(updated, "retryable_failure", {
      providerId: updated.providerId,
      operationFamily: updated.operationFamily,
      circuitOpen: true,
      attempts: updated.attempts,
    }),
  );

  emitOperationalEvent(
    {
      category: "provider_worker_failure",
      severity: "warn",
      operation: `lms.${updated.operationFamily}`,
      tenantId: updated.tenantId,
      correlationId: updated.correlationId,
      message: "LMS provider operation skipped because the provider circuit is open.",
      metadata: {
        providerId: updated.providerId,
        operationFamily: updated.operationFamily,
        jobId: updated.id,
        circuitOpen: true,
      },
    },
    input.emitEvent,
  );

  return input.repository.save(updated);
}

async function completeSuccessfulJob(
  input: LmsExecutionWorkerContext,
  job: LmsOperationJob,
  execution: LmsProviderOperationExecution,
  now: Date,
) {
  const updated: LmsOperationJob = {
    ...job,
    status: "succeeded",
    attempts: job.attempts + 1,
    providerReference: execution.providerReference,
    lastError: undefined,
    updatedAt: nowIso(now),
  };

  await input.resetCircuitAfterSuccess?.(updated.tenantId, updated.providerId);
  await emitAudit(
    input,
    buildAuditEvent(updated, "success", {
      providerId: updated.providerId,
      operationFamily: updated.operationFamily,
      attempts: updated.attempts,
    }),
  );

  return input.repository.save(updated);
}

async function completeFailedJob(
  input: LmsExecutionWorkerContext,
  job: LmsOperationJob,
  execution: LmsProviderOperationExecution,
  now: Date,
) {
  const attempts = job.attempts + 1;
  const retryable = execution.status === "retryable_failure" && attempts < job.maxAttempts;
  const status: LmsOperationJobStatus = retryable ? "retrying" : "failed";
  const safeMessage = redactText(execution.safeMessage);
  const updated: LmsOperationJob = {
    ...job,
    status,
    attempts,
    lastError: safeMessage,
    nextRunAt: retryable
      ? nowIso(new Date(now.getTime() + Math.max(0, execution.retryAfterSeconds ?? 0) * 1000))
      : job.nextRunAt,
    updatedAt: nowIso(now),
  };

  emitOperationalEvent(
    {
      category: "provider_worker_failure",
      severity: retryable ? "warn" : "error",
      operation: `lms.${updated.operationFamily}`,
      tenantId: updated.tenantId,
      correlationId: updated.correlationId,
      message: safeMessage,
      metadata: {
        providerId: updated.providerId,
        operationFamily: updated.operationFamily,
        jobId: updated.id,
        attempts,
        status,
      },
    },
    input.emitEvent,
  );

  await emitAudit(
    input,
    buildAuditEvent(updated, execution.status, {
      providerId: updated.providerId,
      operationFamily: updated.operationFamily,
      attempts,
      retryable,
    }),
  );

  return input.repository.save(updated);
}

export async function runNextLmsOperation(
  input: LmsExecutionWorkerContext,
): Promise<LmsOperationJob | undefined> {
  const now = input.now?.() ?? new Date();
  const job = await input.repository.claimNextDue(now);
  if (!job) return undefined;

  if (job.tenantId !== input.tenantId) {
    await input.repository.save({ ...job, status: job.attempts > 0 ? "retrying" : "queued", updatedAt: nowIso(now) });
    throw new Error("Cross-tenant LMS job execution rejected.");
  }

  if (await input.isProviderCircuitOpen?.(job.tenantId, job.providerId)) {
    return completeCircuitBlockedJob(input, job, now);
  }

  const execution = await input.executor.execute(job.payload);
  if (execution.status === "success") {
    return completeSuccessfulJob(input, job, execution, now);
  }

  return completeFailedJob(input, job, execution, now);
}

export async function runDueLmsOperations(
  input: LmsExecutionWorkerContext,
  limit: number,
): Promise<LmsOperationJob[]> {
  const results: LmsOperationJob[] = [];

  for (let index = 0; index < limit; index += 1) {
    const result = await runNextLmsOperation(input);
    if (!result) break;
    results.push(result);
  }

  return results;
}

export async function markProviderCircuitOpen(
  tenantId: string,
  providerId: LiveLmsProviderId,
  reason: string,
  options: ProviderCircuitOpenOptions = {},
): Promise<void> {
  const safeReason = redactText(reason);

  await options.notifyAdministrators?.({
    tenantId,
    providerId,
    reason: safeReason,
  });

  emitOperationalEvent(
    {
      category: "provider_worker_failure",
      severity: "error",
      operation: "lms.circuit_open",
      tenantId,
      message: "LMS provider circuit opened.",
      metadata: {
        providerId,
        reason: safeReason,
      },
    },
    options.emitEvent,
  );
}

export async function resetProviderCircuitAfterSuccess(
  tenantId: string,
  providerId: LiveLmsProviderId,
  options: ProviderCircuitResetOptions = {},
): Promise<void> {
  await options.resetCircuit?.(tenantId, providerId);

  emitOperationalEvent(
    {
      category: "provider_worker_failure",
      severity: "info",
      operation: "lms.circuit_reset",
      tenantId,
      message: "LMS provider circuit reset after successful operation.",
      metadata: { providerId },
    },
    options.emitEvent,
  );
}

function statusRank(status: LmsProviderOperationExecution["status"]) {
  switch (status) {
    case "retryable_failure":
      return 3;
    case "permanent_failure":
      return 2;
    case "conflict":
      return 1;
    case "success":
      return 0;
  }
}

function summarizeStatus(executions: ExecutedLmsProviderOperation[]): LmsOperationStatus {
  const worst = executions.reduce<LmsProviderOperationExecution["status"]>(
    (selected, execution) => (statusRank(execution.status) > statusRank(selected) ? execution.status : selected),
    "success",
  );

  return worst;
}

function summarizeMessage(status: LmsOperationStatus, count: number) {
  switch (status) {
    case "success":
      return `${count} LMS provider operation${count === 1 ? "" : "s"} executed or replayed successfully.`;
    case "retryable_failure":
      return "LMS provider operation failed with a retryable provider condition.";
    case "permanent_failure":
      return "LMS provider operation failed with a permanent provider condition.";
    case "conflict":
      return "LMS provider operation encountered a provider conflict.";
    default:
      return "LMS provider operation requires review.";
  }
}

export async function executeLmsProviderOperations(
  input: ExecuteLmsProviderOperationsInput,
): Promise<ExecutedLmsProviderOperations> {
  const executions: ExecutedLmsProviderOperation[] = [];

  for (const operation of input.operations) {
    const operationKey = buildLmsOperationIdempotencyKey({
      tenantId: input.tenantId,
      providerId: input.providerId,
      capability: input.capability,
      operationId: operation.idempotencyKey,
    });

    if (input.completedOperationKeys?.has(operationKey)) {
      executions.push({
        operationType: operation.type,
        operationKey,
        status: "success",
        safeMessage: "Duplicate operation replay suppressed.",
      });
      continue;
    }

    const execution = await input.executor.execute(operation);
    executions.push({
      operationType: operation.type,
      operationKey,
      status: execution.status,
      safeMessage: execution.safeMessage,
      providerReference: execution.providerReference,
      retryAfterSeconds: execution.retryAfterSeconds,
    });

    if (execution.status !== "success") {
      emitOperationalEvent(
        {
          category: "provider_worker_failure",
          severity: execution.status === "retryable_failure" ? "warn" : "error",
          operation: `lms.${input.capability}`,
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          message: execution.safeMessage,
          metadata: {
            providerId: input.providerId,
            capability: input.capability,
            operationType: operation.type,
            operationKey,
            status: execution.status,
            retryAfterSeconds: execution.retryAfterSeconds,
          },
        },
        input.emitEvent,
      );
      break;
    }
  }

  const status = summarizeStatus(executions);

  return {
    result: {
      status,
      providerId: input.providerId,
      capability: input.capability,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      operationId: executions[0]?.operationKey ?? `${input.tenantId}:${input.providerId}:${input.capability}:none`,
      retryable: status === "retryable_failure",
      safeMessage: summarizeMessage(status, executions.length),
    },
    auditEvent: input.auditEvent,
    executions,
  };
}
