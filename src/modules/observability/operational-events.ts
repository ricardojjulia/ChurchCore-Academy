export type OperationalEventCategory =
  | "authentication_failure"
  | "authorization_failure"
  | "unexpected_api_error"
  | "workflow_exception"
  | "migration_error"
  | "provider_worker_failure";

export type OperationalEventSeverity = "info" | "warn" | "error" | "critical";

export interface OperationalEvent {
  category: OperationalEventCategory;
  severity: OperationalEventSeverity;
  operation: string;
  occurredAt: string;
  tenantId?: string;
  actorId?: string;
  correlationId?: string;
  status?: number;
  message: string;
  metadata: Record<string, unknown>;
}

export type OperationalEventSink = (event: OperationalEvent) => void;

const sensitiveKeyPattern = /authorization|password|secret|token|credential|raw|payload/i;
const sensitiveValuePattern = /(authorization|password|secret|token|credential)\s*[:=]/i;

export function buildOperationalEvent(input: {
  category: OperationalEventCategory;
  severity: OperationalEventSeverity;
  operation: string;
  tenantId?: string;
  actorId?: string;
  correlationId?: string;
  status?: number;
  message?: string;
  metadata?: Record<string, unknown>;
  now?: string;
}): OperationalEvent {
  return {
    category: input.category,
    severity: input.severity,
    operation: input.operation,
    occurredAt: input.now ?? new Date().toISOString(),
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    status: input.status,
    message: input.message ?? input.category.replaceAll("_", " "),
    metadata: redactObservabilityMetadata(input.metadata ?? {}) as Record<string, unknown>,
  };
}

export function emitOperationalEvent(input: Parameters<typeof buildOperationalEvent>[0], sink: OperationalEventSink = defaultOperationalEventSink) {
  sink(buildOperationalEvent(input));
}

export function redactObservabilityMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactObservabilityMetadata(entry));
  }

  if (typeof value === "string") {
    return sensitiveValuePattern.test(value) ? "[REDACTED]" : value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : redactObservabilityMetadata(entry),
    ]),
  );
}

function defaultOperationalEventSink(event: OperationalEvent) {
  const line = JSON.stringify({
    source: "churchcore-academy",
    event,
  });

  if (event.severity === "critical" || event.severity === "error") {
    console.error(line);
    return;
  }

  console.warn(line);
}
