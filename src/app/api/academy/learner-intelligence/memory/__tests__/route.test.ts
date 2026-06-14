import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { getLearnerMemoryRequest } from "@/app/api/academy/learner-intelligence/memory/route";

const staffActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-llis",
  roles: ["academic_admin"],
};

function createRequest(urlSuffix = "?learnerId=learner-1", headers?: Record<string, string>) {
  return new Request(`http://localhost/api/academy/learner-intelligence/memory${urlSuffix}`, {
    method: "GET",
    headers,
  });
}

test("GET memory returns learner memory for authorized staff", async () => {
  let capturedActor: AcademyActor | undefined;
  let capturedLimit: number | undefined;

  const request = createRequest("?learnerId=learner-1&limit=10", {
    "x-academy-user-id": staffActor.userId,
    "x-academy-tenant-id": staffActor.tenantId,
    "x-academy-roles": staffActor.roles.join(","),
  });

  const response = await getLearnerMemoryRequest(request, {
    listMemoryEntries: async (actor, tenantId, learnerId, limit) => {
      capturedActor = actor;
      capturedLimit = limit;
      return [
        {
          id: "mem-1",
          tenantId,
          learnerId,
          memoryType: "strength_signal",
          sensitivityLevel: "standard",
          content: "Learner is consistently focused in morning sessions.",
          initialConfidence: 0.81,
          confidenceDecayRate: 0.02,
          humanReviewed: true,
          observedAt: "2026-06-14T12:00:00.000Z",
          createdAt: "2026-06-14T12:01:00.000Z",
        },
      ];
    },
  }, staffActor);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(Array.isArray(body.memory), true);
  assert.equal(body.memory.length, 1);
  assert.equal(capturedActor?.tenantId, staffActor.tenantId);
  assert.equal(capturedLimit, 10);
});

test("GET memory returns 400 when learnerId is missing", async () => {
  const request = createRequest("", {
    "x-academy-user-id": staffActor.userId,
    "x-academy-tenant-id": staffActor.tenantId,
    "x-academy-roles": staffActor.roles.join(","),
  });

  const response = await getLearnerMemoryRequest(request, {
    listMemoryEntries: async () => [],
  }, staffActor);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "learnerId query parameter is required." });
});

test("GET memory returns 400 when limit is invalid", async () => {
  const request = createRequest("?learnerId=learner-1&limit=0", {
    "x-academy-user-id": staffActor.userId,
    "x-academy-tenant-id": staffActor.tenantId,
    "x-academy-roles": staffActor.roles.join(","),
  });

  const response = await getLearnerMemoryRequest(request, {
    listMemoryEntries: async () => [],
  }, staffActor);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "limit must be a positive integer." });
});

test("GET memory returns 403 when service denies access", async () => {
  const request = createRequest("?learnerId=learner-1", {
    "x-academy-user-id": "student-1",
    "x-academy-tenant-id": "tenant-llis",
    "x-academy-roles": "student",
  });

  const response = await getLearnerMemoryRequest(request, {
    listMemoryEntries: async () => {
      throw new Error("Forbidden learner intelligence read.");
    },
  }, {
    userId: "student-1",
    tenantId: "tenant-llis",
    roles: ["student"],
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden learner intelligence read." });
});
