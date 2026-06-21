import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import {
  CommunicationsDatabase,
  PostgresCommunicationsRepository,
} from "@/modules/communications/postgres-repository";
import { CommunicationsService } from "@/modules/communications/service";
import type {
  CommunicationAudience,
  CommunicationChannel,
  CommunicationSourceType,
  CommunicationTemplateKey,
} from "@/modules/communications/types";

interface CommunicationsRouteDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  serviceForActor?: (actor: AcademyActor) => Promise<Pick<
    CommunicationsService,
    "createCommunication" | "listMyMessages" | "listTenantMessages" | "markRead" | "recordProviderFailure"
  >>;
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
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
  ];
  if (typeof value === "string" && allowed.includes(value as CommunicationTemplateKey)) {
    return value as CommunicationTemplateKey;
  }
  throw new Error("Invalid communication template.");
}

function sourceType(value: unknown): CommunicationSourceType {
  const allowed: CommunicationSourceType[] = [
    "admissions",
    "registration",
    "transcript",
    "billing",
    "gradebook",
    "attendance",
    "workflow",
    "manual",
  ];
  if (typeof value === "string" && allowed.includes(value as CommunicationSourceType)) {
    return value as CommunicationSourceType;
  }
  throw new Error("Invalid communication source type.");
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

function audience(value: unknown): CommunicationAudience {
  if (!value || typeof value !== "object") {
    throw new Error("audience is required.");
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "student") {
    return { type: "student", personId: text(candidate.personId, "audience.personId") };
  }
  if (candidate.type === "guardian") {
    return { type: "guardian", studentPersonId: text(candidate.studentPersonId, "audience.studentPersonId") };
  }
  if (candidate.type === "staff_role") {
    if (!Array.isArray(candidate.roles) || candidate.roles.length === 0) {
      throw new Error("audience.roles are required.");
    }
    return { type: "staff_role", roles: candidate.roles.map((role) => text(role, "audience.role") as AcademyRole) };
  }
  throw new Error("Invalid communication audience.");
}

function variables(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("variables are required.");
  }
  return value as Record<string, string | number | boolean | null | undefined>;
}

async function defaultServiceForActor(actor: AcademyActor) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresCommunicationsRepository(
      asAcademyDatabase<CommunicationsDatabase>(client),
    );
    return new CommunicationsService(repository);
  });
}

async function resolveActor(
  request: Request,
  dependencies: CommunicationsRouteDependencies,
) {
  return (
    dependencies.resolveActor ??
    (async (currentRequest) =>
      (await resolveAcademyActorFromSession(currentRequest)).actor)
  )(request);
}

export async function listCommunications(
  request: Request,
  dependencies: CommunicationsRouteDependencies = {},
) {
  return handleApi(async () => {
    const actor = await resolveActor(request, dependencies);
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);
    const scope = new URL(request.url).searchParams.get("scope");
    return scope === "tenant"
      ? service.listTenantMessages(actor)
      : service.listMyMessages(actor);
  });
}

export async function mutateCommunications(
  request: Request,
  dependencies: CommunicationsRouteDependencies = {},
) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveActor(request, dependencies);
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);
    const action = text(body.action, "action");

    if (action === "create") {
      return service.createCommunication(actor, {
        templateKey: templateKey(body.templateKey),
        audience: audience(body.audience),
        channels: channels(body.channels),
        variables: variables(body.variables),
        sourceType: sourceType(body.sourceType),
        sourceId: text(body.sourceId, "sourceId"),
        idempotencyKey: text(body.idempotencyKey, "idempotencyKey"),
        essential: Boolean(body.essential),
      });
    }

    if (action === "provider_failure") {
      return service.recordProviderFailure(actor, {
        messageId: text(body.messageId, "messageId"),
        reason: text(body.reason, "reason"),
        rawProviderPayload: body.rawProviderPayload,
      });
    }

    throw new Error("action must be create or provider_failure.");
  });
}

export async function markCommunicationRead(
  request: Request,
  dependencies: CommunicationsRouteDependencies = {},
) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveActor(request, dependencies);
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);
    return service.markRead(actor, text(body.messageId, "messageId"));
  });
}

export async function GET(request: Request) {
  return listCommunications(request);
}

export async function POST(request: Request) {
  return mutateCommunications(request);
}

export async function PATCH(request: Request) {
  return markCommunicationRead(request);
}
