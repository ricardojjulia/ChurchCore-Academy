import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { getLearnerInterventionsRequest } from "@/app/api/academy/learner-intelligence/interventions/route";

const staffActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-llis",
  roles: ["academic_admin"],
};

function createRequest(urlSuffix = "") {
  return new Request(`http://localhost/api/academy/learner-intelligence/interventions${urlSuffix}`, {
    method: "GET",
    headers: {
      "x-academy-user-id": staffActor.userId,
      "x-academy-tenant-id": staffActor.tenantId,
      "x-academy-roles": staffActor.roles.join(","),
    },
  });
}

test("GET interventions returns records for authorized staff", async () => {
  let capturedLimit: number | undefined;

  const request = createRequest("?learnerId=learner-1&status=pending&limit=5");
  const response = await getLearnerInterventionsRequest(request, {
    listInterventions: async (_actor, tenantId, options) => {
      capturedLimit = options.limit;
      return [
        {
          id: "int-1",
          tenantId,
          learnerId: options.learnerId ?? "learner-1",
          riskScore: 0.81,
          riskType: "dark_period",
          status: "pending",
          createdAt: "2026-06-14T13:00:00.000Z",
          expiresAt: "2026-07-01T00:00:00.000Z",
        },
      ];
    },
  }, staffActor);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.count, 1);
  assert.equal(body.interventions[0].riskType, "dark_period");
  assert.equal(capturedLimit, 5);
});

test("GET interventions returns 400 for invalid status", async () => {
  const request = createRequest("?status=unknown");
  const response = await getLearnerInterventionsRequest(request, {
    listInterventions: async () => [],
  }, staffActor);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "status must be one of: pending, reviewed, acted_on, dismissed, expired.",
  });
});

test("GET interventions returns 400 for invalid limit", async () => {
  const request = createRequest("?limit=0");
  const response = await getLearnerInterventionsRequest(request, {
    listInterventions: async () => [],
  }, staffActor);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "limit must be a positive integer." });
});

test("GET interventions returns 403 when service denies access", async () => {
  const request = createRequest();
  const response = await getLearnerInterventionsRequest(request, {
    listInterventions: async () => {
      throw new Error("Forbidden learner intelligence read.");
    },
  }, staffActor);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden learner intelligence read." });
});
