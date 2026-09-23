import assert from "node:assert/strict";
import test from "node:test";
import { handleApi } from "@/app/api/academy/api-utils";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
} from "@/modules/academy-auth/errors";
import type { OperationalEvent } from "@/modules/observability/operational-events";

test("authentication failures return 401", async () => {
  const events: OperationalEvent[] = [];
  const response = await handleApi(async () => {
    throw new AcademyAuthenticationError();
  }, {
    operation: "academy.test",
    emitEvent: (event) => events.push(event),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.category, "authentication_failure");
  assert.equal(events[0]?.operation, "academy.test");
});

test("authorization failures return 403", async () => {
  const events: OperationalEvent[] = [];
  const response = await handleApi(async () => {
    throw new AcademyAuthorizationError();
  }, {
    operation: "academy.test",
    emitEvent: (event) => events.push(event),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden Academy access." });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.category, "authorization_failure");
});

test("unknown failures return a generic 500 response", async () => {
  const events: OperationalEvent[] = [];
  const response = await handleApi(async () => {
    throw new Error("password=database-secret");
  }, {
    operation: "workflow.complete",
    emitEvent: (event) => events.push(event),
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unexpected API error." });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.category, "workflow_exception");
  assert.doesNotMatch(JSON.stringify(events[0]), /database-secret/);
});

test("a handler-built Response passes through with its own status and body", async () => {
  const response = await handleApi(async () =>
    new Response(JSON.stringify({ error: "Cannot archive term with active enrollments", blockingRecords: [{ id: "r1" }] }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Cannot archive term with active enrollments",
    blockingRecords: [{ id: "r1" }],
  });
});

test("plain handler values are still wrapped as a 200 JSON response", async () => {
  const response = await handleApi(async () => ({ success: true }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
});
