import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  listCommunications,
  markCommunicationRead,
  mutateCommunications,
} from "@/app/api/academy/communications/route";
import type { CommunicationMessage } from "@/modules/communications/types";

const adminActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "admin-1",
  roles: ["institution_admin"],
};

const studentActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "student-1",
  roles: ["student"],
};

const message: CommunicationMessage = {
  id: "message-1",
  tenantId: "tenant-1",
  recipientPersonId: "student-1",
  recipientDisplayName: "Ada Rivera",
  recipientEmail: "ada@example.edu",
  channel: "in_app",
  templateKey: "registration_confirmation",
  subject: "Registration confirmed",
  body: "Your registration was confirmed.",
  status: "queued",
  sourceType: "registration",
  sourceId: "registration-1",
  idempotencyKey: "idem-1",
  retryCount: 0,
  createdAt: "2026-06-21T00:00:00.000Z",
};

test("communications route creates messages for authorized staff", async () => {
  const response = await mutateCommunications(
    new Request("http://localhost/api/academy/communications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create",
        templateKey: "registration_confirmation",
        audience: { type: "student", personId: "student-1" },
        channels: ["in_app"],
        variables: {
          studentName: "Ada Rivera",
          sectionName: "Bible Survey",
          actionUrl: "/student/schedule",
        },
        sourceType: "registration",
        sourceId: "registration-1",
        idempotencyKey: "idem-1",
        essential: true,
      }),
    }),
    {
      resolveActor: async () => adminActor,
      serviceForActor: async () => ({
        createCommunication: async () => [message],
        listMyMessages: async () => [],
        listTenantMessages: async () => [],
        markRead: async () => message,
        recordProviderFailure: async () => message,
      }),
    },
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as CommunicationMessage[];
  assert.equal(payload[0].recipientPersonId, "student-1");
});

test("communications route lists student self-scoped messages", async () => {
  const response = await listCommunications(
    new Request("http://localhost/api/academy/communications"),
    {
      resolveActor: async () => studentActor,
      serviceForActor: async () => ({
        createCommunication: async () => [],
        listMyMessages: async (actor: AcademyActor) => [{ ...message, recipientPersonId: actor.userId }],
        listTenantMessages: async () => [],
        markRead: async () => message,
        recordProviderFailure: async () => message,
      }),
    },
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as CommunicationMessage[];
  assert.equal(payload[0].recipientPersonId, "student-1");
});

test("communications route marks only the current recipient message read", async () => {
  const response = await markCommunicationRead(
    new Request("http://localhost/api/academy/communications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: "message-1" }),
    }),
    {
      resolveActor: async () => studentActor,
      serviceForActor: async () => ({
        createCommunication: async () => [],
        listMyMessages: async () => [],
        listTenantMessages: async () => [],
        markRead: async (_actor: AcademyActor, messageId: string) => ({
          ...message,
          id: messageId,
          status: "read",
        }),
        recordProviderFailure: async () => message,
      }),
    },
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as CommunicationMessage;
  assert.equal(payload.status, "read");
});
