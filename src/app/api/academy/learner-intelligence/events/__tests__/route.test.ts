import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { submitLearnerActivityEventRequest } from "@/app/api/academy/learner-intelligence/events/route";

const actor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-llis",
  roles: ["academic_admin"],
};

function createRequest(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/academy/learner-intelligence/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("POST events records event with actor tenant and returns ok", async () => {
  let capturedActor: AcademyActor | undefined;
  let capturedInput: Record<string, unknown> | undefined;

  const request = createRequest(
    {
      learnerId: "learner-1",
      eventType: "content_viewed",
      metadata: { dwellSeconds: 33 },
    },
    {
      "x-academy-user-id": actor.userId,
      "x-academy-tenant-id": actor.tenantId,
      "x-academy-roles": actor.roles.join(","),
    },
  );

  const response = await submitLearnerActivityEventRequest(request, {
    recordActivityEvent: async (serviceActor, input) => {
      capturedActor = serviceActor;
      capturedInput = input as unknown as Record<string, unknown>;
    },
  }, actor);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(capturedActor?.tenantId, actor.tenantId);
  assert.equal(capturedInput?.tenantId, actor.tenantId);
  assert.equal(capturedInput?.learnerId, "learner-1");
  assert.equal(capturedInput?.eventType, "content_viewed");
});

test("POST events returns 400 for malformed JSON", async () => {
  const request = new Request("http://localhost/api/academy/learner-intelligence/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });

  const response = await submitLearnerActivityEventRequest(request, {
    recordActivityEvent: async () => {},
  }, actor);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Malformed JSON body." });
});

test("POST events returns 400 for invalid payload", async () => {
  const request = createRequest({ eventType: "content_viewed" });

  const response = await submitLearnerActivityEventRequest(request, {
    recordActivityEvent: async () => {},
  }, actor);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "learnerId and eventType are required." });
});

test("POST events returns 403 when service rejects actor authorization", async () => {
  const request = createRequest(
    {
      learnerId: "learner-1",
      eventType: "content_viewed",
    },
    {
      "x-academy-user-id": "student-1",
      "x-academy-tenant-id": "tenant-llis",
      "x-academy-roles": "student",
    },
  );

  const response = await submitLearnerActivityEventRequest(request, {
    recordActivityEvent: async () => {
      throw new Error("Forbidden learner intelligence event write.");
    },
  }, actor);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden learner intelligence event write." });
});
