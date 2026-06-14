import assert from "node:assert/strict";
import test from "node:test";
import { AdmissionApplication } from "@/modules/admissions/types";
import { evaluateEnrollmentConversionEligibility } from "@/modules/enrollment-conversion/eligibility";

function application(
  overrides: Partial<AdmissionApplication> = {},
): AdmissionApplication {
  return {
    id: "application-1",
    tenantId: "tenant-1",
    applicantPersonId: "person-applicant",
    programId: "program-1",
    applicationTermId: "term-1",
    legalName: "Jordan Rivera",
    email: "jordan@example.com",
    status: "accepted",
    createdAt: "2026-06-13T14:00:00.000Z",
    updatedAt: "2026-06-13T15:00:00.000Z",
    ...overrides,
  };
}

test("an accepted application with an academic period is eligible", () => {
  assert.deepEqual(
    evaluateEnrollmentConversionEligibility(application()),
    { kind: "eligible" },
  );
});

test("a non-accepted application is blocked", () => {
  assert.deepEqual(
    evaluateEnrollmentConversionEligibility(
      application({ status: "under_review" }),
    ),
    {
      kind: "blocked",
      reason: "Only accepted applications can be converted to students.",
    },
  );
});

test("an accepted application without an academic period is blocked", () => {
  assert.deepEqual(
    evaluateEnrollmentConversionEligibility(
      application({ applicationTermId: undefined }),
    ),
    {
      kind: "blocked",
      reason:
        "Assign an application term before converting this application.",
    },
  );
});

test("an application with complete conversion metadata is replay-only", () => {
  assert.deepEqual(
    evaluateEnrollmentConversionEligibility(
      application({
        convertedAt: "2026-06-13T16:00:00.000Z",
        convertedByPersonId: "person-registrar",
        studentProfileId: "profile-1",
        programEnrollmentId: "program-enrollment-1",
        periodRegistrationId: "period-registration-1",
        studentNumber: "S-000001",
      }),
    ),
    { kind: "already_converted" },
  );
});

test("partial conversion metadata is treated as a data conflict", () => {
  assert.deepEqual(
    evaluateEnrollmentConversionEligibility(
      application({
        convertedAt: "2026-06-13T16:00:00.000Z",
        studentProfileId: "profile-1",
      }),
    ),
    {
      kind: "blocked",
      reason: "Application conversion metadata is incomplete.",
    },
  );
});
