import { AdmissionApplication } from "@/modules/admissions/types";

export type EnrollmentConversionEligibility =
  | { kind: "eligible" }
  | { kind: "already_converted" }
  | { kind: "blocked"; reason: string };

const conversionMetadataKeys = [
  "convertedAt",
  "convertedByPersonId",
  "studentProfileId",
  "programEnrollmentId",
  "periodRegistrationId",
  "studentNumber",
] as const;

export function evaluateEnrollmentConversionEligibility(
  application: AdmissionApplication,
): EnrollmentConversionEligibility {
  const conversionValues = conversionMetadataKeys.map(
    (key) => application[key],
  );
  const populatedCount = conversionValues.filter(Boolean).length;

  if (populatedCount === conversionMetadataKeys.length) {
    return { kind: "already_converted" };
  }
  if (populatedCount > 0) {
    return {
      kind: "blocked",
      reason: "Application conversion metadata is incomplete.",
    };
  }
  if (application.status !== "accepted") {
    return {
      kind: "blocked",
      reason: "Only accepted applications can be converted to students.",
    };
  }
  if (!application.applicationTermId) {
    return {
      kind: "blocked",
      reason:
        "Assign an application term before converting this application.",
    };
  }
  return { kind: "eligible" };
}
