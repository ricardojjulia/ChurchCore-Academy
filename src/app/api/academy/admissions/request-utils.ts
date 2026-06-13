export function requireIdempotencyKey(headers: Headers) {
  const value = headers.get("idempotency-key")?.trim();
  if (!value) {
    throw new Error("Idempotency-Key is required.");
  }
  return value;
}

export function parseAdmissionDecision(value: unknown): {
  decision: "accepted" | "declined";
  reason?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Admission decision must be a JSON object.");
  }
  const payload = value as Record<string, unknown>;
  if (payload.decision !== "accepted" && payload.decision !== "declined") {
    throw new Error("decision must be accepted or declined.");
  }
  if (
    payload.reason !== undefined &&
    payload.reason !== null &&
    typeof payload.reason !== "string"
  ) {
    throw new Error("reason must be a string.");
  }

  const reason =
    typeof payload.reason === "string" && payload.reason.trim().length > 0
      ? payload.reason.trim()
      : undefined;
  return { decision: payload.decision, reason };
}

export function toAdmissionApplicationResponse(
  application: AdmissionApplication,
): AdmissionApplication {
  return {
    id: application.id,
    tenantId: application.tenantId,
    applicantPersonId: application.applicantPersonId,
    programId: application.programId,
    applicationTermId: application.applicationTermId,
    legalName: application.legalName,
    preferredName: application.preferredName,
    email: application.email,
    phone: application.phone,
    status: application.status,
    submittedAt: application.submittedAt,
    decidedAt: application.decidedAt,
    decidedByPersonId: application.decidedByPersonId,
    decisionReason: application.decisionReason,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}
import { AdmissionApplication } from "@/modules/admissions/types";
