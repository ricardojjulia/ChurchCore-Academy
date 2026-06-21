import {
  type LmsCapability,
  type LmsOperationResult,
  type LmsOperationStatus,
  type LmsProviderId,
  type LmsAuditEvent,
} from "@/modules/lms-contract/contract";
import { buildLmsOperationIdempotencyKey } from "@/modules/lms-contract/sync-audit-reconciliation";

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
  providerId: Exclude<LmsProviderId, "none">;
  capability: LmsCapability;
  correlationId: string;
  operations: LmsExecutableProviderOperation[];
  auditEvent?: LmsAuditEvent;
  executor: LmsProviderOperationExecutor;
  completedOperationKeys?: ReadonlySet<string>;
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
