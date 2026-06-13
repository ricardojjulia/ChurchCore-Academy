import assert from "node:assert/strict";
import test from "node:test";
import { buildAdmissionReviewModel } from "@/modules/admissions/review-model";
import { AdmissionApplication } from "@/modules/admissions/types";

const applications: AdmissionApplication[] = [
  {
    id: "application-draft",
    tenantId: "tenant-1",
    applicantPersonId: "person-1",
    programId: "program-1",
    legalName: "Jordan Rivera",
    preferredName: "Jordan",
    email: "jordan@example.com",
    phone: "555-0100",
    status: "draft",
    createdAt: "2026-06-12T14:30:00.000Z",
    updatedAt: "2026-06-12T14:30:00.000Z",
  },
  {
    id: "application-submitted",
    tenantId: "tenant-1",
    applicantPersonId: "person-2",
    programId: "program-2",
    legalName: "Taylor Morgan",
    email: "taylor@example.com",
    status: "submitted",
    submittedAt: "2026-06-13T15:00:00.000Z",
    createdAt: "2026-06-12T14:30:00.000Z",
    updatedAt: "2026-06-13T15:00:00.000Z",
  },
  {
    id: "application-review",
    tenantId: "tenant-1",
    applicantPersonId: "person-3",
    programId: "program-2",
    legalName: "Morgan Lee",
    email: "morgan@example.com",
    status: "under_review",
    submittedAt: "2026-06-13T13:00:00.000Z",
    createdAt: "2026-06-11T14:30:00.000Z",
    updatedAt: "2026-06-13T16:00:00.000Z",
  },
  {
    id: "application-accepted",
    tenantId: "tenant-1",
    applicantPersonId: "person-4",
    programId: "program-3",
    legalName: "Alex Kim",
    email: "alex@example.com",
    status: "accepted",
    applicationTermId: "term-1",
    submittedAt: "2026-06-10T13:00:00.000Z",
    decidedAt: "2026-06-13T17:00:00.000Z",
    decidedByPersonId: "person-staff",
    decisionReason: "Requirements met",
    createdAt: "2026-06-09T14:30:00.000Z",
    updatedAt: "2026-06-13T17:00:00.000Z",
  },
  {
    id: "application-declined",
    tenantId: "tenant-1",
    applicantPersonId: "person-5",
    programId: "program-3",
    legalName: "Casey Bell",
    email: "casey@example.com",
    status: "declined",
    submittedAt: "2026-06-10T13:00:00.000Z",
    decidedAt: "2026-06-13T18:00:00.000Z",
    createdAt: "2026-06-09T14:30:00.000Z",
    updatedAt: "2026-06-13T18:00:00.000Z",
  },
];

test("builds display-ready admissions metrics and dates", () => {
  const model = buildAdmissionReviewModel(applications, {
    includeApplicantContact: true,
    canConvertApplications: true,
  });

  assert.deepEqual(
    model.metrics.map(({ label, value }) => [label, value]),
    [
      ["Draft", 1],
      ["Awaiting review", 2],
      ["Accepted", 1],
      ["Declined", 1],
    ],
  );
  assert.equal(model.applications[1].statusLabel, "Submitted");
  assert.equal(model.applications[1].submittedDate, "Jun 13, 2026");
  assert.equal(model.applications[3].decisionDate, "Jun 13, 2026");
});

test("includes applicant contact only for authorized staff", () => {
  const staffModel = buildAdmissionReviewModel(applications, {
    includeApplicantContact: true,
    canConvertApplications: true,
  });
  const restrictedModel = buildAdmissionReviewModel(applications, {
    includeApplicantContact: false,
    canConvertApplications: false,
  });

  assert.equal(staffModel.applications[0].email, "jordan@example.com");
  assert.equal(staffModel.applications[0].phone, "555-0100");
  assert.equal("email" in restrictedModel.applications[0], false);
  assert.equal("phone" in restrictedModel.applications[0], false);
});

test("excludes events, audit metadata, idempotency keys, and decision notes", () => {
  const unsafe = {
    ...applications[3],
    events: [{ eventType: "accepted" }],
    auditMetadata: { correlationId: "secret" },
    idempotencyKey: "idem-secret",
  } as AdmissionApplication;
  const item = buildAdmissionReviewModel([unsafe], {
    includeApplicantContact: true,
    canConvertApplications: true,
  }).applications[0] as unknown as Record<string, unknown>;

  assert.equal("events" in item, false);
  assert.equal("auditMetadata" in item, false);
  assert.equal("idempotencyKey" in item, false);
  assert.equal("decisionReason" in item, false);
  assert.equal("decidedByPersonId" in item, false);
});

test("projects ready, blocked, converted, and non-applicable conversion states", () => {
  const converted = {
    ...applications[3],
    id: "application-converted",
    convertedAt: "2026-06-13T19:00:00.000Z",
    convertedByPersonId: "person-staff",
    studentProfileId: "profile-1",
    programEnrollmentId: "program-enrollment-1",
    periodRegistrationId: "period-registration-1",
    studentNumber: "S-000001",
  };
  const missingTerm = {
    ...applications[3],
    id: "application-missing-term",
    applicationTermId: undefined,
  };
  const model = buildAdmissionReviewModel(
    [applications[0], applications[3], missingTerm, converted],
    {
      includeApplicantContact: true,
      canConvertApplications: true,
    },
  );

  assert.equal(model.applications[0].conversionState, "not_applicable");
  assert.equal(model.applications[1].conversionState, "ready");
  assert.equal(model.applications[1].canConvert, true);
  assert.equal(model.applications[2].conversionState, "blocked");
  assert.match(model.applications[2].conversionMessage, /application term/);
  assert.equal(model.applications[3].conversionState, "converted");
  assert.equal(model.applications[3].studentNumber, "S-000001");
});

test("review-capable roles without conversion authority see a disabled state", () => {
  const model = buildAdmissionReviewModel([applications[3]], {
    includeApplicantContact: true,
    canConvertApplications: false,
  });

  assert.equal(model.applications[0].conversionState, "ready");
  assert.equal(model.applications[0].canConvert, false);
  assert.match(
    model.applications[0].conversionMessage,
    /Registrar or admissions authorization/,
  );
});
