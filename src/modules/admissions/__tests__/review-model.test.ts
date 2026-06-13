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
  });
  const restrictedModel = buildAdmissionReviewModel(applications, {
    includeApplicantContact: false,
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
  }).applications[0] as unknown as Record<string, unknown>;

  assert.equal("events" in item, false);
  assert.equal("auditMetadata" in item, false);
  assert.equal("idempotencyKey" in item, false);
  assert.equal("decisionReason" in item, false);
  assert.equal("decidedByPersonId" in item, false);
});
