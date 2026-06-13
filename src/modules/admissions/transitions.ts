import { AdmissionApplicationStatus } from "@/modules/admissions/types";

const allowedTransitions: Record<
  AdmissionApplicationStatus,
  ReadonlySet<AdmissionApplicationStatus>
> = {
  draft: new Set(["submitted", "withdrawn"]),
  submitted: new Set(["under_review", "accepted", "declined", "withdrawn"]),
  under_review: new Set(["accepted", "declined", "withdrawn"]),
  accepted: new Set(),
  declined: new Set(),
  withdrawn: new Set(),
};

export function assertAdmissionTransition(
  current: AdmissionApplicationStatus,
  next: AdmissionApplicationStatus,
) {
  if (!allowedTransitions[current].has(next)) {
    throw new Error("Invalid admission application transition.");
  }
}
