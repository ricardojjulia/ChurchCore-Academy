import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/academy/learner-intelligence/interventions/[id]/history/route";

test("GET intervention history returns records for authorized staff", async () => {
  const request = new Request("http://localhost/api/academy/learner-intelligence/interventions/int-1/history?limit=10", {
    method: "GET",
    headers: {
      "x-academy-user-id": "staff-1",
      "x-academy-tenant-id": "tenant-llis",
      "x-academy-roles": "academic_admin",
    },
  });

  const response = await GET(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      listInterventionStatusHistory: async () => [
        {
          id: "hist-1",
          tenantId: "tenant-llis",
          interventionId: "int-1",
          previousStatus: "pending",
          nextStatus: "reviewed",
          changedByUserId: "staff-1",
          note: "Reviewed and assigned mentor check-in.",
          changedAt: "2026-06-14T10:00:00.000Z",
        },
      ],
    },
    {
      userId: "staff-1",
      tenantId: "tenant-llis",
      roles: ["academic_admin"],
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.count, 1);
  assert.equal(body.history[0].nextStatus, "reviewed");
});

test("GET intervention history returns 400 for invalid limit", async () => {
  const request = new Request("http://localhost/api/academy/learner-intelligence/interventions/int-1/history?limit=0", {
    method: "GET",
    headers: {
      "x-academy-user-id": "staff-1",
      "x-academy-tenant-id": "tenant-llis",
      "x-academy-roles": "academic_admin",
    },
  });

  const response = await GET(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      listInterventionStatusHistory: async () => [],
    },
    {
      userId: "staff-1",
      tenantId: "tenant-llis",
      roles: ["academic_admin"],
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "limit must be a positive integer." });
});

test("GET intervention history returns 403 when service denies access", async () => {
  const request = new Request("http://localhost/api/academy/learner-intelligence/interventions/int-1/history", {
    method: "GET",
    headers: {
      "x-academy-user-id": "student-1",
      "x-academy-tenant-id": "tenant-llis",
      "x-academy-roles": "student",
    },
  });

  const response = await GET(
    request,
    { params: Promise.resolve({ id: "int-1" }) },
    {
      listInterventionStatusHistory: async () => {
        throw new Error("Forbidden learner intelligence read.");
      },
    },
    {
      userId: "student-1",
      tenantId: "tenant-llis",
      roles: ["student"],
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden learner intelligence read." });
});
