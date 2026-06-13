import { CreateAdmissionApplicationInput } from "@/modules/admissions/types";

const serverOwnedFields = new Set([
  "status",
  "submittedAt",
  "decidedAt",
  "decidedByPersonId",
  "decisionReason",
  "createdAt",
  "updatedAt",
]);

function requiredString(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }

  return value.trim();
}

function optionalString(
  input: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = input[field];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeCreateAdmissionApplicationInput(
  value: unknown,
  actorTenantId: string,
): CreateAdmissionApplicationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Admission application must be a JSON object.");
  }

  const input = value as Record<string, unknown>;
  for (const field of serverOwnedFields) {
    if (field in input) {
      throw new Error(
        "Admission application contains server-owned fields.",
      );
    }
  }

  const tenantId = requiredString(input, "tenantId");
  if (tenantId !== actorTenantId) {
    throw new Error("Forbidden admission application tenant.");
  }

  return {
    tenantId,
    applicantPersonId: requiredString(input, "applicantPersonId"),
    programId: requiredString(input, "programId"),
    applicationTermId: optionalString(input, "applicationTermId"),
    legalName: requiredString(input, "legalName"),
    preferredName: optionalString(input, "preferredName"),
    email: requiredString(input, "email").toLowerCase(),
    phone: optionalString(input, "phone"),
  };
}
