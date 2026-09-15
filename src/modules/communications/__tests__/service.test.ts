import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  CommunicationsService,
  renderCommunicationTemplate,
  resolveCommunicationAudience,
} from "@/modules/communications/service";
import type {
  CommunicationDirectory,
  CommunicationMessage,
  CommunicationsRepository,
  CreateCommunicationInput,
} from "@/modules/communications/types";

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

const facultyActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "faculty-1",
  roles: ["faculty"],
};

const directory: CommunicationDirectory = {
  people: [
    { id: "student-1", displayName: "Ada Rivera", email: "ada@example.edu", roles: ["student"] },
    { id: "guardian-1", displayName: "Marisol Rivera", email: "marisol@example.edu", roles: ["guardian"] },
    { id: "faculty-1", displayName: "Dr. Stone", email: "stone@example.edu", roles: ["faculty"] },
  ],
  relationships: [
    {
      studentPersonId: "student-1",
      relatedPersonId: "guardian-1",
      relationshipType: "guardian",
      visibility: "full_guardian",
      status: "active",
    },
  ],
  emailOptOutPersonIds: ["guardian-1"],
};

class FakeCommunicationsRepository implements CommunicationsRepository {
  messages: CommunicationMessage[] = [];
  auditEvents: string[] = [];
  directoryRequests: string[] = [];

  async loadDirectory(tenantId: string) {
    this.directoryRequests.push(tenantId);
    return directory;
  }

  async findByIdempotencyKey(tenantId: string, idempotencyKey: string) {
    return this.messages.filter(
      (message) => message.tenantId === tenantId && message.idempotencyKey === idempotencyKey,
    );
  }

  async enqueueMessages(messages: CommunicationMessage[], auditEvents: string[]) {
    this.messages.push(...messages);
    this.auditEvents.push(...auditEvents);
    return messages;
  }

  async listMessages(tenantId: string, recipientPersonId?: string) {
    return this.messages.filter(
      (message) =>
        message.tenantId === tenantId &&
        (!recipientPersonId || message.recipientPersonId === recipientPersonId),
    );
  }

  async markRead(tenantId: string, messageId: string, recipientPersonId: string) {
    const message = this.messages.find(
      (item) =>
        item.tenantId === tenantId &&
        item.id === messageId &&
        item.recipientPersonId === recipientPersonId,
    );
    if (!message) throw new Error(`Communication message ${messageId} was not found.`);
    message.status = "read";
    message.readAt = "2026-06-21T00:00:00.000Z";
    this.auditEvents.push("read");
    return message;
  }

  async markProviderFailure(tenantId: string, messageId: string, reason: string) {
    const message = this.messages.find((item) => item.tenantId === tenantId && item.id === messageId);
    if (!message) throw new Error(`Communication message ${messageId} was not found.`);
    message.status = "failed";
    message.retryCount += 1;
    message.failureReason = reason;
    this.auditEvents.push("failed");
    return message;
  }
}

function input(overrides: Partial<CreateCommunicationInput> = {}): CreateCommunicationInput {
  return {
    templateKey: "registration_confirmation",
    audience: { type: "student", personId: "student-1" },
    channels: ["in_app", "email"],
    variables: {
      studentName: "Ada Rivera",
      sectionName: "Bible Survey",
      actionUrl: "/student/schedule",
    },
    sourceType: "registration",
    sourceId: "registration-1",
    idempotencyKey: "idem-1",
    essential: true,
    ...overrides,
  };
}

test("template rendering is deterministic and rejects unsafe provider variables", () => {
  assert.deepEqual(
    renderCommunicationTemplate("registration_confirmation", {
      studentName: "Ada Rivera",
      sectionName: "Bible Survey",
      actionUrl: "/student/schedule",
    }),
    {
      subject: "Registration confirmed for Bible Survey",
      body: "Ada Rivera, your registration for Bible Survey has been confirmed. Review details at /student/schedule.",
    },
  );

  assert.throws(
    () =>
      renderCommunicationTemplate("billing_account_update", {
        studentName: "Ada Rivera",
        clientSecret: "sk_live_unsafe",
      }),
    /Provider secret variables are not allowed/,
  );
});

test("audience resolver includes active guardians only through relationships", () => {
  const recipients = resolveCommunicationAudience(directory, {
    type: "guardian",
    studentPersonId: "student-1",
  });

  assert.deepEqual(recipients.map((recipient) => recipient.personId), ["guardian-1"]);
});

test("service queues in-app message and suppresses non-essential opted-out email", async () => {
  const repository = new FakeCommunicationsRepository();
  const service = new CommunicationsService(repository);

  const messages = await service.createCommunication(
    adminActor,
    input({
      audience: { type: "guardian", studentPersonId: "student-1" },
      essential: false,
    }),
  );

  assert.equal(messages.length, 1);
  assert.equal(messages[0].channel, "in_app");
  assert.equal(messages[0].recipientPersonId, "guardian-1");
  assert.deepEqual(repository.auditEvents, ["queued"]);
});

test("service replays idempotent communication creates", async () => {
  const repository = new FakeCommunicationsRepository();
  const service = new CommunicationsService(repository);

  const first = await service.createCommunication(adminActor, input());
  const second = await service.createCommunication(adminActor, input());

  assert.equal(first.length, 2);
  assert.equal(second.length, 2);
  assert.equal(repository.messages.length, 2);
});

test("students read and mark only their own messages", async () => {
  const repository = new FakeCommunicationsRepository();
  const service = new CommunicationsService(repository);
  const [message] = await service.createCommunication(adminActor, input({ channels: ["in_app"] }));

  const messages = await service.listMyMessages(studentActor);
  assert.equal(messages.length, 1);

  const read = await service.markRead(studentActor, message.id);
  assert.equal(read.status, "read");
});

test("non-admin actors cannot create communications", async () => {
  const service = new CommunicationsService(new FakeCommunicationsRepository());

  await assert.rejects(
    () => service.createCommunication(facultyActor, input()),
    AcademyAuthorizationError,
  );
});

test("provider failure records retry metadata without raw provider payloads", async () => {
  const repository = new FakeCommunicationsRepository();
  const service = new CommunicationsService(repository);
  const messages = await service.createCommunication(adminActor, input({ channels: ["email"] }));

  const failed = await service.recordProviderFailure(adminActor, {
    messageId: messages[0].id,
    reason: "provider timeout",
    rawProviderPayload: { apiKey: "should-not-persist", trace: "raw" },
  });

  assert.equal(failed.status, "failed");
  assert.equal(failed.retryCount, 1);
  assert.equal(failed.failureReason, "provider timeout");
  assert.doesNotMatch(JSON.stringify(failed), /apiKey|should-not-persist|raw/);
});
