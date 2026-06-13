import assert from "node:assert/strict";
import test from "node:test";
import { AdmissionsService } from "@/modules/admissions/service";
import {
  AdmissionApplication,
  AdmissionApplicationEventInput,
} from "@/modules/admissions/types";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuditEventInput } from "@/modules/audit/types";

const applicantActor: AcademyActor = {
  userId: "person-applicant",
  tenantId: "tenant-1",
  roles: ["applicant"],
};

const staffActor: AcademyActor = {
  userId: "person-staff",
  tenantId: "tenant-1",
  roles: ["admissions"],
};

function draft(
  overrides: Partial<AdmissionApplication> = {},
): AdmissionApplication {
  return {
    id: "application-1",
    tenantId: "tenant-1",
    applicantPersonId: "person-applicant",
    programId: "program-1",
    legalName: "Jordan Rivera",
    email: "jordan@example.com",
    status: "draft",
    createdAt: "2026-06-13T14:30:00.000Z",
    updatedAt: "2026-06-13T14:30:00.000Z",
    ...overrides,
  };
}

function fixture(existing?: AdmissionApplication) {
  let application = existing;
  const events: AdmissionApplicationEventInput[] = [];
  const audits: AcademyAuditEventInput[] = [];
  const mutations = new Map<
    string,
    {
      application: AdmissionApplication;
      eventType: AdmissionApplicationEventInput["eventType"];
    }
  >();

  return {
    repository: {
      findById: async () => application,
      findByIdempotencyKey: async () => application,
      findMutationByIdempotencyKey: async (
        _tenantId: string,
        idempotencyKey: string,
      ) => mutations.get(idempotencyKey),
      create: async () => {
        application = draft();
        return application;
      },
      transition: async (
        _tenantId: string,
        _applicationId: string,
        _expectedStatus: AdmissionApplication["status"],
        nextStatus: AdmissionApplication["status"],
        decision?: {
          decidedAt: string;
          decidedByPersonId: string;
          decisionReason?: string;
        },
      ) => {
        application = draft({
          ...application,
          status: nextStatus,
          submittedAt:
            nextStatus === "submitted"
              ? "2026-06-13T15:00:00.000Z"
              : application?.submittedAt,
          ...decision,
        });
        return application;
      },
      appendEvent: async (event: AdmissionApplicationEventInput) => {
        events.push(event);
        if (application) {
          mutations.set(event.idempotencyKey, {
            application,
            eventType: event.eventType,
          });
        }
      },
    },
    audit: {
      append: async (event: AcademyAuditEventInput) => {
        audits.push(event);
        return {
          ...event,
          id: `audit-${audits.length}`,
          occurredAt: "2026-06-13T15:00:00.000Z",
          redactedMetadata: event.redactedMetadata ?? {},
        };
      },
    },
    events,
    audits,
  };
}

test("creates a same-tenant draft and appends application and global audit events", async () => {
  const state = fixture();
  const service = new AdmissionsService(state.repository, state.audit, () =>
    "2026-06-13T15:00:00.000Z"
  );

  const application = await service.createDraft(
    applicantActor,
    {
      tenantId: "tenant-1",
      applicantPersonId: "person-applicant",
      programId: "program-1",
      legalName: "Jordan Rivera",
      email: "jordan@example.com",
    },
    "corr-1",
    "idem-1",
  );

  assert.equal(application.status, "draft");
  assert.equal(state.events[0].eventType, "created");
  assert.equal(state.audits[0].action, "admission.application.created");
});

test("returns an existing draft for a duplicate idempotency key", async () => {
  const state = fixture(draft());
  const service = new AdmissionsService(state.repository, state.audit);

  const application = await service.createDraft(
    applicantActor,
    {
      tenantId: "tenant-1",
      applicantPersonId: "person-applicant",
      programId: "program-1",
      legalName: "Jordan Rivera",
      email: "jordan@example.com",
    },
    "corr-1",
    "idem-1",
  );

  assert.equal(application.id, "application-1");
  assert.equal(state.events.length, 0);
});

test("submits an owned draft exactly once", async () => {
  const state = fixture(draft());
  const service = new AdmissionsService(state.repository, state.audit, () =>
    "2026-06-13T15:00:00.000Z"
  );

  const application = await service.submit(
    applicantActor,
    "application-1",
    "corr-2",
    "idem-2",
  );

  assert.equal(application.status, "submitted");
  assert.equal(state.events[0].eventType, "submitted");

  const replay = await service.submit(
    applicantActor,
    "application-1",
    "corr-2-retry",
    "idem-2",
  );

  assert.equal(replay.status, "submitted");
  assert.equal(state.events.length, 1);
  assert.equal(state.audits.length, 1);
});

test("accepts a submitted application as admissions staff", async () => {
  const state = fixture(draft({ status: "submitted" }));
  const service = new AdmissionsService(state.repository, state.audit, () =>
    "2026-06-13T15:00:00.000Z"
  );

  const application = await service.decide(
    staffActor,
    "application-1",
    "accepted",
    "Requirements met",
    "corr-3",
    "idem-3",
  );

  assert.equal(application.status, "accepted");
  assert.equal(application.decidedByPersonId, "person-staff");
  assert.equal(state.events[0].eventType, "accepted");

  const replay = await service.decide(
    staffActor,
    "application-1",
    "accepted",
    "Requirements met",
    "corr-3-retry",
    "idem-3",
  );

  assert.equal(replay.status, "accepted");
  assert.equal(state.events.length, 1);
  assert.equal(state.audits.length, 1);
});

test("rejects reuse of a mutation idempotency key for another action", async () => {
  const state = fixture(draft());
  const service = new AdmissionsService(state.repository, state.audit);

  await service.submit(
    applicantActor,
    "application-1",
    "corr-2",
    "idem-shared",
  );

  await assert.rejects(
    () =>
      service.decide(
        staffActor,
        "application-1",
        "accepted",
        undefined,
        "corr-3",
        "idem-shared",
      ),
    /Idempotency key was already used for another admissions mutation/,
  );
});

test("rejects applicant self-acceptance and cross-tenant commands", async () => {
  const state = fixture(draft({ status: "submitted" }));
  const service = new AdmissionsService(state.repository, state.audit);

  await assert.rejects(
    () =>
      service.decide(
        applicantActor,
        "application-1",
        "accepted",
        undefined,
        "corr-3",
        "idem-3",
      ),
    /Forbidden admissions access/,
  );
  await assert.rejects(
    () =>
      service.submit(
        { ...applicantActor, tenantId: "tenant-2" },
        "application-1",
        "corr-4",
        "idem-4",
      ),
    /not found|Forbidden/,
  );
});
