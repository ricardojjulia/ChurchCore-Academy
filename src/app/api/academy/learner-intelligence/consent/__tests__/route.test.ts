import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { submitLearnerConsentRequest } from "@/app/api/academy/learner-intelligence/consent/route";

const actor: AcademyActor = {
  userId: "student-1",
  tenantId: "tenant-llis",
  roles: ["student"],
};

function createRequest(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/academy/learner-intelligence/consent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("POST consent upserts learner consent and returns ok", async () => {
  let capturedActor: AcademyActor | undefined;
  let capturedInput: Record<string, unknown> | undefined;

  const request = createRequest(
    {
      learnerId: "student-1",
      consentVersion: "v1",
      consentBehavioralTracking: true,
      consentAiMemory: true,
    },
    {
      "x-academy-user-id": actor.userId,
      "x-academy-tenant-id": actor.tenantId,
      "x-academy-roles": actor.roles.join(","),
    },
  );

  const response = await submitLearnerConsentRequest(request, {
    upsertConsent: async (serviceActor, input) => {
      capturedActor = serviceActor;
      capturedInput = input as unknown as Record<string, unknown>;
    },
  }, actor);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(capturedActor?.tenantId, actor.tenantId);
  assert.equal(capturedInput?.tenantId, actor.tenantId);
  assert.equal(capturedInput?.learnerId, "student-1");
  assert.equal(capturedInput?.consentVersion, "v1");
});

test("POST consent returns 400 for malformed JSON", async () => {
  const request = new Request("http://localhost/api/academy/learner-intelligence/consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });

  const response = await submitLearnerConsentRequest(request, {
    upsertConsent: async () => {},
  }, actor);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Malformed JSON body." });
});

test("POST consent returns 400 for invalid payload", async () => {
  const request = createRequest({ learnerId: "student-1" });

  const response = await submitLearnerConsentRequest(request, {
    upsertConsent: async () => {},
  }, actor);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "learnerId and consentVersion are required." });
});

test("POST consent returns 403 when service rejects cross-learner consent write", async () => {
  const request = createRequest(
    {
      learnerId: "student-2",
      consentVersion: "v1",
      consentBehavioralTracking: true,
      consentAiMemory: true,
    },
    {
      "x-academy-user-id": "student-1",
      "x-academy-tenant-id": "tenant-llis",
      "x-academy-roles": "student",
    },
  );

  const response = await submitLearnerConsentRequest(request, {
    upsertConsent: async () => {
      throw new Error("Forbidden learner intelligence consent write.");
    },
  }, actor);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden learner intelligence consent write." });
});
