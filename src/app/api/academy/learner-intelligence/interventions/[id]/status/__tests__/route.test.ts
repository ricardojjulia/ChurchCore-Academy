import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { POST } from "@/app/api/academy/learner-intelligence/interventions/[id]/status/route";

const staffActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-llis",
  roles: ["academic_admin"],
};

function createRequest(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/academy/learner-intelligence/interventions/int-1/status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("POST intervention status updates recommendation for authorized staff", async () => {
  const request = createRequest(
    {
      status: "reviewed",
      instructorNotes: "Reviewed with advisor and scheduled follow-up.",
      expectedCurrentStatus: "pending",
    },
    {
      "x-academy-user-id": staffActor.userId,
      "x-academy-tenant-id": staffActor.tenantId,
      "x-academy-roles": staffActor.roles.join(","),
    },
  );

  const response = await POST(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      updateInterventionStatus: async (_actor, tenantId, interventionId, input) => ({
        id: interventionId,
        tenantId,
        learnerId: "learner-1",
        riskScore: 0.77,
        riskType: "low_momentum",
        status: input.status,
        createdAt: "2026-06-14T12:00:00.000Z",
        expiresAt: "2026-07-05T00:00:00.000Z",
      }),
    },
    staffActor,
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.intervention.id, "int-1");
  assert.equal(body.intervention.status, "reviewed");
});

test("POST intervention status returns 400 for malformed JSON", async () => {
  const request = new Request("http://localhost/api/academy/learner-intelligence/interventions/int-1/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });

  const response = await POST(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      updateInterventionStatus: async () => {
        throw new Error("should not run");
      },
    },
    staffActor,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Malformed JSON body." });
});

test("POST intervention status returns 400 for invalid status payload", async () => {
  const request = createRequest({ status: "unknown" }, {
    "x-academy-user-id": staffActor.userId,
    "x-academy-tenant-id": staffActor.tenantId,
    "x-academy-roles": staffActor.roles.join(","),
  });

  const response = await POST(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      updateInterventionStatus: async () => {
        throw new Error("should not run");
      },
    },
    staffActor,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "status must be one of: pending, reviewed, acted_on, dismissed, expired.",
  });
});

test("POST intervention status returns 400 when expectedCurrentStatus is missing", async () => {
  const request = createRequest(
    { status: "reviewed" },
    {
      "x-academy-user-id": staffActor.userId,
      "x-academy-tenant-id": staffActor.tenantId,
      "x-academy-roles": staffActor.roles.join(","),
    },
  );

  const response = await POST(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      updateInterventionStatus: async () => {
        throw new Error("should not run");
      },
    },
    staffActor,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "expectedCurrentStatus is required." });
});

test("POST intervention status returns 400 for invalid expectedCurrentStatus", async () => {
  const request = createRequest({ status: "reviewed", expectedCurrentStatus: "unknown" }, {
    "x-academy-user-id": staffActor.userId,
    "x-academy-tenant-id": staffActor.tenantId,
    "x-academy-roles": staffActor.roles.join(","),
  });

  const response = await POST(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      updateInterventionStatus: async () => {
        throw new Error("should not run");
      },
    },
    staffActor,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "expectedCurrentStatus must be one of: pending, reviewed, acted_on, dismissed, expired.",
  });
});

test("POST intervention status returns 403 when service denies access", async () => {
  const request = createRequest(
    { status: "reviewed", expectedCurrentStatus: "pending" },
    {
      "x-academy-user-id": "student-1",
      "x-academy-tenant-id": "tenant-llis",
      "x-academy-roles": "student",
    },
  );

  const response = await POST(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      updateInterventionStatus: async () => {
        throw new Error("Forbidden learner intelligence write.");
      },
    },
    {
      userId: "student-1",
      tenantId: "tenant-llis",
      roles: ["student"],
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden learner intelligence write." });
});

test("POST intervention status returns 409 for optimistic concurrency conflicts", async () => {
  const request = createRequest(
    {
      status: "reviewed",
      expectedCurrentStatus: "pending",
    },
    {
      "x-academy-user-id": staffActor.userId,
      "x-academy-tenant-id": staffActor.tenantId,
      "x-academy-roles": staffActor.roles.join(","),
    },
  );

  const response = await POST(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      updateInterventionStatus: async () => {
        throw new Error("Conflict intervention status update. Expected pending, found reviewed.");
      },
    },
    staffActor,
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Conflict intervention status update. Expected pending, found reviewed.",
  });
});

test("POST intervention status returns 400 for invalid transition rejected by service", async () => {
  const request = createRequest(
    {
      status: "pending",
      expectedCurrentStatus: "dismissed",
    },
    {
      "x-academy-user-id": staffActor.userId,
      "x-academy-tenant-id": staffActor.tenantId,
      "x-academy-roles": staffActor.roles.join(","),
    },
  );

  const response = await POST(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      updateInterventionStatus: async () => {
        throw new Error("Invalid status transition from dismissed to pending.");
      },
    },
    staffActor,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid status transition from dismissed to pending.",
  });
});
