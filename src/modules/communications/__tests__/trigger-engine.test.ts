import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CommunicationMessage } from "@/modules/communications/types";
import type { CommunicationsService } from "@/modules/communications/service";
import {
  type CommunicationEventPayload,
  type CommunicationTrigger,
  type CommunicationTriggersDatabase,
  type UpsertTriggerInput,
  fireCommunicationEvent,
  listTriggers,
  upsertTrigger,
} from "@/modules/communications/trigger-engine";

// Mock database
class MockTriggersDatabase implements CommunicationTriggersDatabase {
  triggers: CommunicationTrigger[] = [];

  async query(sql: string, values?: unknown[]) {
    if (sql.includes("select") && sql.includes("academy_communication_triggers")) {
      const tenantId = values?.[0];
      const eventType = values?.[1];

      let results = this.triggers.filter((trigger) => trigger.tenantId === tenantId);

      if (eventType) {
        results = results.filter((trigger) => trigger.eventType === eventType);
      }

      return {
        rows: results.map((trigger) => ({
          id: trigger.id,
          tenant_id: trigger.tenantId,
          event_type: trigger.eventType,
          template_key: trigger.templateKey,
          audience_type: trigger.audienceType,
          channels: trigger.channels,
          essential: trigger.essential,
          active: trigger.active,
          created_at: trigger.createdAt,
          updated_at: trigger.updatedAt,
        })),
      };
    }

    if (sql.includes("insert into academy_communication_triggers")) {
      const [tenantId, eventType, templateKey, audienceType, channels, essential, active] =
        values as [string, string, string, string, string[], boolean, boolean];

      const existingIndex = this.triggers.findIndex(
        (trigger) =>
          trigger.tenantId === tenantId &&
          trigger.eventType === eventType &&
          trigger.templateKey === templateKey,
      );

      const trigger: CommunicationTrigger = {
        id: existingIndex >= 0 ? this.triggers[existingIndex].id : `trigger-${Date.now()}`,
        tenantId,
        eventType: eventType as CommunicationTrigger["eventType"],
        templateKey: templateKey as CommunicationTrigger["templateKey"],
        audienceType: audienceType as CommunicationTrigger["audienceType"],
        channels: channels as CommunicationTrigger["channels"],
        essential,
        active,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        this.triggers[existingIndex] = trigger;
      } else {
        this.triggers.push(trigger);
      }

      return {
        rows: [
          {
            id: trigger.id,
            tenant_id: trigger.tenantId,
            event_type: trigger.eventType,
            template_key: trigger.templateKey,
            audience_type: trigger.audienceType,
            channels: trigger.channels,
            essential: trigger.essential,
            active: trigger.active,
            created_at: trigger.createdAt,
            updated_at: trigger.updatedAt,
          },
        ],
      };
    }

    return { rows: [] };
  }
}

// Mock communications service
class MockCommunicationsService implements Pick<CommunicationsService, "createCommunication"> {
  createdMessages: CommunicationMessage[] = [];
  shouldFail = false;

  async createCommunication(
    actor: AcademyActor,
    input: {
      templateKey: string;
      audience: unknown;
      channels: string[];
      variables: Record<string, unknown>;
      sourceType: string;
      sourceId: string;
      idempotencyKey: string;
      essential: boolean;
      sendAt?: string;
    },
  ): Promise<CommunicationMessage[]> {
    if (this.shouldFail) {
      throw new Error("Mock service failure");
    }

    const message: CommunicationMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      tenantId: actor.tenantId,
      recipientPersonId: "person-123",
      recipientDisplayName: "Test Person",
      recipientEmail: "test@example.com",
      channel: input.channels[0] as CommunicationMessage["channel"],
      templateKey: input.templateKey as CommunicationMessage["templateKey"],
      subject: "Test Subject",
      body: "Test Body",
      status: "queued",
      sourceType: input.sourceType as CommunicationMessage["sourceType"],
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      retryCount: 0,
      sendAt: input.sendAt,
      createdAt: new Date().toISOString(),
    };

    this.createdMessages.push(message);
    return [message];
  }
}

test("listTriggers - returns triggers for tenant", async () => {
  const database = new MockTriggersDatabase();
  database.triggers = [
    {
      id: "trigger-1",
      tenantId: "tenant-a",
      eventType: "registration_confirmed",
      templateKey: "registration_confirmation",
      audienceType: "student",
      channels: ["in_app", "email"],
      essential: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "trigger-2",
      tenantId: "tenant-b",
      eventType: "grade_posted",
      templateKey: "grade_release",
      audienceType: "guardian",
      channels: ["email"],
      essential: true,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const triggers = await listTriggers("tenant-a", database);

  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].id, "trigger-1");
  assert.equal(triggers[0].eventType, "registration_confirmed");
});

test("upsertTrigger - creates trigger for admin actor", async () => {
  const database = new MockTriggersDatabase();
  const actor: AcademyActor = {
    tenantId: "tenant-a",
    userId: "user-admin",
    roles: ["institution_admin"],
  };

  const input: UpsertTriggerInput = {
    eventType: "registration_confirmed",
    templateKey: "registration_confirmation",
    audienceType: "student",
    channels: ["in_app", "email"],
    essential: false,
    active: true,
  };

  const trigger = await upsertTrigger(actor, input, database);

  assert.equal(trigger.tenantId, "tenant-a");
  assert.equal(trigger.eventType, "registration_confirmed");
  assert.equal(trigger.templateKey, "registration_confirmation");
  assert.equal(trigger.audienceType, "student");
  assert.equal(trigger.channels.length, 2);
  assert.equal(trigger.active, true);
  assert.equal(database.triggers.length, 1);
});

test("upsertTrigger - updates existing trigger on conflict", async () => {
  const database = new MockTriggersDatabase();
  database.triggers = [
    {
      id: "trigger-1",
      tenantId: "tenant-a",
      eventType: "registration_confirmed",
      templateKey: "registration_confirmation",
      audienceType: "student",
      channels: ["in_app"],
      essential: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const actor: AcademyActor = {
    tenantId: "tenant-a",
    userId: "user-admin",
    roles: ["institution_admin"],
  };

  const input: UpsertTriggerInput = {
    eventType: "registration_confirmed",
    templateKey: "registration_confirmation",
    audienceType: "guardian",
    channels: ["email"],
    essential: true,
    active: false,
  };

  const trigger = await upsertTrigger(actor, input, database);

  assert.equal(trigger.id, "trigger-1"); // Same ID
  assert.equal(trigger.audienceType, "guardian"); // Updated
  assert.equal(trigger.channels.length, 1);
  assert.equal(trigger.channels[0], "email");
  assert.equal(trigger.essential, true);
  assert.equal(trigger.active, false);
  assert.equal(database.triggers.length, 1); // Still only one trigger
});

test("upsertTrigger - rejects non-admin", async () => {
  const database = new MockTriggersDatabase();
  const actor: AcademyActor = {
    tenantId: "tenant-a",
    userId: "user-student",
    roles: ["student"],
  };

  const input: UpsertTriggerInput = {
    eventType: "registration_confirmed",
    templateKey: "registration_confirmation",
    audienceType: "student",
    channels: ["in_app"],
    essential: false,
    active: true,
  };

  await assert.rejects(
    async () => upsertTrigger(actor, input, database),
    AcademyAuthorizationError,
  );
});

test("upsertTrigger - enforces cross-tenant isolation", async () => {
  const database = new MockTriggersDatabase();
  database.triggers = [
    {
      id: "trigger-1",
      tenantId: "tenant-a",
      eventType: "grade_posted",
      templateKey: "grade_release",
      audienceType: "student",
      channels: ["email"],
      essential: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const actorB: AcademyActor = {
    tenantId: "tenant-b",
    userId: "user-admin-b",
    roles: ["institution_admin"],
  };

  const input: UpsertTriggerInput = {
    eventType: "registration_confirmed",
    templateKey: "registration_confirmation",
    audienceType: "student",
    channels: ["in_app"],
    essential: false,
    active: true,
  };

  await upsertTrigger(actorB, input, database);

  // Verify tenant-b actor created a trigger in tenant-b only
  const triggersB = await listTriggers("tenant-b", database);
  assert.equal(triggersB.length, 1);
  assert.equal(triggersB[0].tenantId, "tenant-b");

  // Verify tenant-a trigger is untouched
  const triggersA = await listTriggers("tenant-a", database);
  assert.equal(triggersA.length, 1);
  assert.equal(triggersA[0].tenantId, "tenant-a");
  assert.equal(triggersA[0].eventType, "grade_posted");
});

test("fireCommunicationEvent - fires correct number of matching triggers", async () => {
  const database = new MockTriggersDatabase();
  database.triggers = [
    {
      id: "trigger-1",
      tenantId: "tenant-a",
      eventType: "registration_confirmed",
      templateKey: "registration_confirmation",
      audienceType: "student",
      channels: ["in_app"],
      essential: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "trigger-2",
      tenantId: "tenant-a",
      eventType: "registration_confirmed",
      templateKey: "workflow_assignment",
      audienceType: "student",
      channels: ["email"],
      essential: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "trigger-3",
      tenantId: "tenant-a",
      eventType: "grade_posted",
      templateKey: "grade_release",
      audienceType: "guardian",
      channels: ["email"],
      essential: true,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const service = new MockCommunicationsService();

  const payload: CommunicationEventPayload = {
    eventType: "registration_confirmed",
    tenantId: "tenant-a",
    studentPersonId: "student-123",
    variables: { studentName: "John Doe", sectionName: "Biology 101", actionUrl: "/courses" },
    sourceId: "registration-456",
  };

  const result = await fireCommunicationEvent(payload, service, database);

  assert.equal(result.fired, 2); // Two triggers match registration_confirmed
  assert.equal(service.createdMessages.length, 2);
  assert.equal(service.createdMessages[0].templateKey, "registration_confirmation");
  assert.equal(service.createdMessages[1].templateKey, "workflow_assignment");
});

test("fireCommunicationEvent - swallows a failing trigger", async () => {
  const database = new MockTriggersDatabase();
  database.triggers = [
    {
      id: "trigger-1",
      tenantId: "tenant-a",
      eventType: "grade_posted",
      templateKey: "grade_release",
      audienceType: "student",
      channels: ["in_app"],
      essential: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "trigger-2",
      tenantId: "tenant-a",
      eventType: "grade_posted",
      templateKey: "workflow_assignment",
      audienceType: "student",
      channels: ["email"],
      essential: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const service = new MockCommunicationsService();
  let firstCall = true;
  const originalCreateCommunication = service.createCommunication.bind(service);
  service.createCommunication = async (...args) => {
    if (firstCall) {
      firstCall = false;
      throw new Error("First trigger fails");
    }
    return originalCreateCommunication(...args);
  };

  const payload: CommunicationEventPayload = {
    eventType: "grade_posted",
    tenantId: "tenant-a",
    studentPersonId: "student-123",
    variables: { studentName: "Jane Doe", sectionName: "Math 201", actionUrl: "/grades" },
    sourceId: "grade-789",
  };

  const result = await fireCommunicationEvent(payload, service, database);

  // One trigger failed, one succeeded
  assert.equal(result.fired, 1);
  assert.equal(service.createdMessages.length, 1);
});

test("fireCommunicationEvent - sends nothing when no triggers configured for event type", async () => {
  const database = new MockTriggersDatabase();
  database.triggers = [
    {
      id: "trigger-1",
      tenantId: "tenant-a",
      eventType: "grade_posted",
      templateKey: "grade_release",
      audienceType: "student",
      channels: ["email"],
      essential: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const service = new MockCommunicationsService();

  const payload: CommunicationEventPayload = {
    eventType: "payment_due",
    tenantId: "tenant-a",
    studentPersonId: "student-123",
    variables: { studentName: "Test Student", amount: "100", dueDate: "2026-07-01" },
    sourceId: "payment-999",
  };

  const result = await fireCommunicationEvent(payload, service, database);

  assert.equal(result.fired, 0);
  assert.equal(service.createdMessages.length, 0);
});

test("fireCommunicationEvent - sets send_at for scheduled messages", async () => {
  const database = new MockTriggersDatabase();
  database.triggers = [
    {
      id: "trigger-1",
      tenantId: "tenant-a",
      eventType: "payment_due",
      templateKey: "billing_account_update",
      audienceType: "student",
      channels: ["email"],
      essential: true,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const service = new MockCommunicationsService();

  const sendAt = "2026-07-01T12:00:00.000Z";

  const payload: CommunicationEventPayload = {
    eventType: "payment_due",
    tenantId: "tenant-a",
    studentPersonId: "student-123",
    variables: { studentName: "Test Student", summary: "Payment due", actionUrl: "/billing" },
    sourceId: "payment-999",
    sendAt,
  };

  const result = await fireCommunicationEvent(payload, service, database);

  assert.equal(result.fired, 1);
  assert.equal(service.createdMessages.length, 1);
  assert.equal(service.createdMessages[0].sendAt, sendAt);
});
