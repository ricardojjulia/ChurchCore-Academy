import type { LmsRosterPlanInput, LmsRosterSourceSection } from "./types";

const activeRegistrationStatuses = new Set(["registered", "pending_confirmation"]);
const includedRegistrationStatuses = new Set(["registered", "pending_confirmation", "completed", "withdrawn"]);

export function buildRosterIdempotencyKey(sectionId: string) {
  return `academy-roster:${sectionId}`;
}

export function buildRosterSyncPlanInputFromSource(
  section: LmsRosterSourceSection,
  idempotencyKey = buildRosterIdempotencyKey(section.id),
): LmsRosterPlanInput {
  const enrollmentStates: LmsRosterPlanInput["enrollmentStates"] = {};
  const studentPersonIds: string[] = [];

  for (const registration of section.registrations) {
    if (!includedRegistrationStatuses.has(registration.status)) {
      continue;
    }
    if (enrollmentStates[registration.studentPersonId]) {
      continue;
    }

    studentPersonIds.push(registration.studentPersonId);
    enrollmentStates[registration.studentPersonId] = activeRegistrationStatuses.has(registration.status)
      ? "active"
      : registration.status === "completed"
        ? "completed"
        : "withdrawn";
  }

  return {
    sectionId: section.id,
    instructorPersonIds: section.primaryInstructorId ? [section.primaryInstructorId] : [],
    studentPersonIds,
    enrollmentStates,
    idempotencyKey,
  };
}
