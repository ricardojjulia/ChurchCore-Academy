import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type {
  CommunicationChannel,
  CommunicationTemplateKey,
} from "@/modules/communications/types";
import {
  type CommunicationEventType,
  type CommunicationTriggersDatabase,
  type UpsertTriggerInput,
  listTriggers,
  upsertTrigger,
} from "@/modules/communications/trigger-engine";

interface TriggersRouteDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function eventType(value: unknown): CommunicationEventType {
  const allowed: CommunicationEventType[] = [
    "registration_confirmed",
    "grade_posted",
    "attendance_threshold_crossed",
    "aid_package_offered",
    "transcript_requested",
    "payment_due",
  ];
  if (typeof value === "string" && allowed.includes(value as CommunicationEventType)) {
    return value as CommunicationEventType;
  }
  throw new Error("Invalid communication event type.");
}

function templateKey(value: unknown): CommunicationTemplateKey {
  const allowed: CommunicationTemplateKey[] = [
    "admissions_decision",
    "registration_confirmation",
    "transcript_update",
    "billing_account_update",
    "grade_release",
    "attendance_concern",
    "workflow_assignment",
    "application_received",
    "award_letter_ready",
  ];
  if (typeof value === "string" && allowed.includes(value as CommunicationTemplateKey)) {
    return value as CommunicationTemplateKey;
  }
  throw new Error("Invalid communication template key.");
}

function audienceType(value: unknown): "student" | "guardian" | "staff_role" {
  if (value === "student" || value === "guardian" || value === "staff_role") {
    return value;
  }
  throw new Error("Invalid audience type. Must be student, guardian, or staff_role.");
}

function channels(value: unknown): CommunicationChannel[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("channels are required.");
  }
  return value.map((item) => {
    if (item === "in_app" || item === "email") return item;
    throw new Error("Invalid communication channel.");
  });
}

async function resolveActor(
  request: Request,
  dependencies: TriggersRouteDependencies,
): Promise<AcademyActor> {
  return (
    dependencies.resolveActor ??
    (async (currentRequest) =>
      (await resolveAcademyActorFromSession(currentRequest)).actor)
  )(request);
}

export async function listCommunicationTriggers(
  request: Request,
  dependencies: TriggersRouteDependencies = {},
) {
  return handleApi(async () => {
    const actor = await resolveActor(request, dependencies);
    return withAcademyDatabaseContext(actor, async (client) => {
      return listTriggers(
        actor.tenantId,
        asAcademyDatabase<CommunicationTriggersDatabase>(client),
      );
    });
  });
}

export async function mutateCommunicationTriggers(
  request: Request,
  dependencies: TriggersRouteDependencies = {},
) {
  return handleApi(async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const actor = await resolveActor(request, dependencies);

    const input: UpsertTriggerInput = {
      eventType: eventType(body.eventType),
      templateKey: templateKey(body.templateKey),
      audienceType: audienceType(body.audienceType),
      channels: channels(body.channels),
      essential: Boolean(body.essential),
      active: Boolean(body.active),
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return upsertTrigger(
        actor,
        input,
        asAcademyDatabase<CommunicationTriggersDatabase>(client),
      );
    });
  });
}

export async function GET(request: Request) {
  return listCommunicationTriggers(request);
}

export async function POST(request: Request) {
  return mutateCommunicationTriggers(request);
}
