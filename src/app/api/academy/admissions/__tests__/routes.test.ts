import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdmissionApplicationRequest,
} from "@/app/api/academy/admissions/applications/route";
import {
  decideAdmissionApplicationRequest,
} from "@/app/api/academy/admissions/applications/[id]/decision/route";
import {
  convertAdmissionApplicationRequest,
} from "@/app/api/academy/admissions/applications/[id]/convert/route";
import { handleApi } from "@/app/api/academy/api-utils";
import {
  requireIdempotencyKey,
  parseAdmissionDecision,
} from "@/app/api/academy/admissions/request-utils";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import {
  AcademyAuthenticationError,
} from "@/modules/academy-auth/errors";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AdmissionApplication } from "@/modules/admissions/types";
import { EnrollmentConversionResult } from "@/modules/enrollment-conversion/types";

const applicant: AcademyActor = {
  userId: "person-applicant",
  tenantId: "tenant-1",
  roles: ["applicant"],
};

const application: AdmissionApplication = {
  id: "application-1",
  tenantId: "tenant-1",
  applicantPersonId: "person-applicant",
  programId: "program-1",
  legalName: "Jordan Rivera",
  email: "jordan@example.com",
  status: "draft",
  createdAt: "2026-06-13T14:30:00.000Z",
  updatedAt: "2026-06-13T14:30:00.000Z",
};

test("admissions mutations require an idempotency key", () => {
  assert.throws(
    () => requireIdempotencyKey(new Headers()),
    /Idempotency-Key is required/,
  );
  assert.equal(
    requireIdempotencyKey(
      new Headers({ "Idempotency-Key": " admission-1 " }),
    ),
    "admission-1",
  );
});

test("decision payload accepts only accepted or declined", () => {
  assert.deepEqual(
    parseAdmissionDecision({
      decision: "accepted",
      reason: "Requirements met",
    }),
    { decision: "accepted", reason: "Requirements met" },
  );
  assert.throws(
    () => parseAdmissionDecision({ decision: "draft" }),
    /decision must be accepted or declined/,
  );
});

test("admissions conflicts return 409 without exposing persistence details", async () => {
  const response = await handleApi(async () => {
    throw new AcademyConflictError(
      "Admission application status changed concurrently.",
    );
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Admission application status changed concurrently.",
  });
});

test("create route returns 401 when no verified actor is available", async () => {
  const response = await createAdmissionApplicationRequest(
    new Request("http://localhost/api/academy/admissions/applications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "idem-1",
      },
      body: JSON.stringify({}),
    }),
    {
      resolveActor: async () => {
        throw new AcademyAuthenticationError();
      },
      createDraft: async () => application,
    },
  );

  assert.equal(response.status, 401);
});

test("create route rejects malformed JSON and forbidden roles", async () => {
  const malformed = await createAdmissionApplicationRequest(
    new Request("http://localhost/api/academy/admissions/applications", {
      method: "POST",
      headers: { "idempotency-key": "idem-1" },
      body: "{broken",
    }),
    {
      resolveActor: async () => applicant,
      createDraft: async () => application,
    },
  );
  assert.equal(malformed.status, 400);

  const forbidden = await createAdmissionApplicationRequest(
    new Request("http://localhost/api/academy/admissions/applications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "idem-2",
      },
      body: JSON.stringify({
        tenantId: "tenant-1",
        applicantPersonId: "person-student",
        programId: "program-1",
        legalName: "Student User",
        email: "student@example.com",
      }),
    }),
    {
      resolveActor: async () => ({
        userId: "person-student",
        tenantId: "tenant-1",
        roles: ["student"],
      }),
      createDraft: async () => application,
    },
  );
  assert.equal(forbidden.status, 403);
});

test("create route returns the existing safe application on idempotent replay", async () => {
  const response = await createAdmissionApplicationRequest(
    new Request("http://localhost/api/academy/admissions/applications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "idem-existing",
      },
      body: JSON.stringify({
        tenantId: "tenant-1",
        applicantPersonId: "person-applicant",
        programId: "program-1",
        legalName: "Jordan Rivera",
        email: "jordan@example.com",
      }),
    }),
    {
      resolveActor: async () => applicant,
      createDraft: async () =>
        ({
          ...application,
          auditMetadata: { secret: true },
          events: [{ eventType: "created" }],
        }) as AdmissionApplication,
    },
  );
  const body = (await response.json()) as {
    application: Record<string, unknown>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.application.id, "application-1");
  assert.equal("auditMetadata" in body.application, false);
  assert.equal("events" in body.application, false);
});

test("decision route maps transition conflicts and unknown failures safely", async () => {
  const request = () =>
    new Request(
      "http://localhost/api/academy/admissions/applications/application-1/decision",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "idem-decision",
        },
        body: JSON.stringify({ decision: "accepted" }),
      },
    );
  const context = { params: Promise.resolve({ id: "application-1" }) };

  const conflict = await decideAdmissionApplicationRequest(
    request(),
    context,
    {
      resolveActor: async () => ({
        userId: "person-staff",
        tenantId: "tenant-1",
        roles: ["admissions"],
      }),
      decide: async () => {
        throw new AcademyConflictError("Invalid admission transition.");
      },
    },
  );
  assert.equal(conflict.status, 409);

  const failure = await decideAdmissionApplicationRequest(
    request(),
    context,
    {
      resolveActor: async () => ({
        userId: "person-staff",
        tenantId: "tenant-1",
        roles: ["admissions"],
      }),
      decide: async () => {
        throw new Error("password=database-secret");
      },
    },
  );
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: "Unexpected API error." });
});

test("conversion route requires authentication and an idempotency key", async () => {
  const context = { params: Promise.resolve({ id: "application-1" }) };
  const conversion: EnrollmentConversionResult = {
    applicationId: "application-1",
    studentProfileId: "profile-1",
    studentNumber: "S-000001",
    programEnrollmentId: "program-enrollment-1",
    periodRegistrationId: "period-registration-1",
    convertedAt: "2026-06-13T16:00:00.000Z",
    idempotencyKey: "key-1",
  };

  const unauthenticated = await convertAdmissionApplicationRequest(
    new Request(
      "http://localhost/api/academy/admissions/applications/application-1/convert",
      { method: "POST", headers: { "idempotency-key": "key-1" } },
    ),
    context,
    {
      resolveActor: async () => {
        throw new AcademyAuthenticationError();
      },
      convert: async () => conversion,
    },
  );
  assert.equal(unauthenticated.status, 401);

  const missingKey = await convertAdmissionApplicationRequest(
    new Request(
      "http://localhost/api/academy/admissions/applications/application-1/convert",
      { method: "POST" },
    ),
    context,
    {
      resolveActor: async () => ({
        userId: "person-registrar",
        tenantId: "tenant-1",
        roles: ["registrar"],
      }),
      convert: async () => conversion,
    },
  );
  assert.equal(missingKey.status, 400);
});

test("conversion route returns the safe conversion projection and maps conflicts", async () => {
  const context = { params: Promise.resolve({ id: "application-1" }) };
  const request = () =>
    new Request(
      "http://localhost/api/academy/admissions/applications/application-1/convert",
      {
        method: "POST",
        headers: {
          "idempotency-key": "key-1",
          "x-correlation-id": "correlation-1",
        },
      },
    );
  const actor: AcademyActor = {
    userId: "person-registrar",
    tenantId: "tenant-1",
    roles: ["registrar"],
  };

  const success = await convertAdmissionApplicationRequest(
    request(),
    context,
    {
      resolveActor: async () => actor,
      convert: async (
        receivedActor,
        applicationId,
        correlationId,
        idempotencyKey,
      ) => {
        assert.equal(receivedActor, actor);
        assert.equal(applicationId, "application-1");
        assert.equal(correlationId, "correlation-1");
        assert.equal(idempotencyKey, "key-1");
        return {
          applicationId,
          studentProfileId: "profile-1",
          studentNumber: "S-000001",
          programEnrollmentId: "program-enrollment-1",
          periodRegistrationId: "period-registration-1",
          convertedAt: "2026-06-13T16:00:00.000Z",
          idempotencyKey,
        };
      },
    },
  );
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), {
    applicationId: "application-1",
    studentProfileId: "profile-1",
    studentNumber: "S-000001",
    programEnrollmentId: "program-enrollment-1",
    periodRegistrationId: "period-registration-1",
    convertedAt: "2026-06-13T16:00:00.000Z",
  });

  const conflict = await convertAdmissionApplicationRequest(
    request(),
    context,
    {
      resolveActor: async () => actor,
      convert: async () => {
        throw new AcademyConflictError(
          "Application was already converted with another idempotency key.",
        );
      },
    },
  );
  assert.equal(conflict.status, 409);
});
