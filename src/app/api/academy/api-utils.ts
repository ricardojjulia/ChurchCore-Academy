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
