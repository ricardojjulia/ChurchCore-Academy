import { NextResponse } from "next/server";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import { CapabilityDisabledError } from "@/modules/academy-auth/policy";
import {
  emitOperationalEvent,
  type OperationalEventCategory,
  type OperationalEventSink,
} from "@/modules/observability/operational-events";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// String(undefined) and String(null) return the literal strings "undefined"/"null" rather than
// throwing, so a required-field write route that does `String(body.x)` unconditionally silently
// persists those literal strings when the caller omits the field, instead of rejecting the
// request. TypeScript's `as` casts on request bodies have the same blind spot for enum/boolean
// fields — they affect only compile-time types, not the actual runtime value. These helpers
// give write routes real runtime validation instead. Found via code review.
export function requireStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}: must be a non-empty string.`);
  }
  return value;
}

export function requireBooleanField(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${fieldName}: must be a boolean.`);
  }
  return value;
}

export function optionalBooleanField(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${fieldName}: must be a boolean.`);
  }
  return value;
}

export interface ApiObservabilityOptions {
  operation?: string;
  tenantId?: string;
  actorId?: string;
  correlationId?: string;
  emitEvent?: OperationalEventSink;
}

export async function handleApi<T>(handler: () => Promise<T>, observability: ApiObservabilityOptions = {}) {
  try {
    return jsonOk(await handler());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected API error.";

    if (error instanceof AcademyAuthenticationError) {
      emitApiFailure("authentication_failure", 401, message, observability);
      return jsonError(message, 401);
    }

    if (
      error instanceof AcademyAuthorizationError ||
      message.includes("Forbidden")
    ) {
      emitApiFailure("authorization_failure", 403, message, observability);
      return jsonError(message, 403);
    }

    if (error instanceof CapabilityDisabledError) {
      return NextResponse.json(
        { available: false, capability: error.capability, reason: "Not enabled for this institution." },
        { status: 451 },
      );
    }

    if (error instanceof AcademyConflictError) {
      return jsonError(message, 409);
    }

    if (message.includes("not found") || message.includes("was not found")) {
      return jsonError(message, 404);
    }

    if (
      message.startsWith("Invalid ") ||
      message.startsWith("Malformed ") ||
      message.includes(" is required") ||
      message.includes(" are required") ||
      message.includes(" must ")
    ) {
      return jsonError(message, 400);
    }

    emitApiFailure(
      observability.operation?.startsWith("workflow.") ? "workflow_exception" : "unexpected_api_error",
      500,
      "Unexpected API error.",
      {
        ...observability,
        metadata: {
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: message,
        },
      },
    );
    return jsonError("Unexpected API error.", 500);
  }
}

function emitApiFailure(
  category: OperationalEventCategory,
  status: number,
  message: string,
  observability: ApiObservabilityOptions & { metadata?: Record<string, unknown> },
) {
  const event: Parameters<typeof emitOperationalEvent>[0] = {
    category,
    severity: status >= 500 ? "error" : "warn",
    operation: observability.operation ?? "api.request",
    tenantId: observability.tenantId,
    actorId: observability.actorId,
    correlationId: observability.correlationId,
    status,
    message,
    metadata: observability.metadata ?? {},
  };

  emitOperationalEvent(event, observability.emitEvent);
}
