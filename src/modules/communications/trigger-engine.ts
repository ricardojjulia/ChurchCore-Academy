import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CommunicationsService } from "@/modules/communications/service";
import type {
  CommunicationAudience,
  CommunicationChannel,
  CommunicationTemplateKey,
} from "@/modules/communications/types";

export type CommunicationEventType =
  | "registration_confirmed"
  | "grade_posted"
  | "attendance_threshold_crossed"
  | "aid_package_offered"
  | "transcript_requested"
  | "payment_due";

export interface CommunicationEventPayload {
  eventType: CommunicationEventType;
  tenantId: string;
  studentPersonId: string;
  variables: Record<string, string | number | boolean | null | undefined>;
  sourceId: string;
  sendAt?: string; // ISO string; undefined = immediate
}

export interface CommunicationTrigger {
  id: string;
  tenantId: string;
  eventType: CommunicationEventType;
  templateKey: CommunicationTemplateKey;
  audienceType: "student" | "guardian" | "staff_role";
  channels: CommunicationChannel[];
  essential: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertTriggerInput {
  eventType: CommunicationEventType;
  templateKey: CommunicationTemplateKey;
  audienceType: "student" | "guardian" | "staff_role";
  channels: CommunicationChannel[];
  essential: boolean;
  active: boolean;
}

export interface CommunicationTriggersDatabase {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

function assertInstitutionAdmin(actor: AcademyActor) {
  if (!actor.roles.includes("institution_admin")) {
    throw new AcademyAuthorizationError("Forbidden: institution_admin role required.");
  }
}

function mapTrigger(row: Record<string, unknown>): CommunicationTrigger {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    eventType: String(row.event_type) as CommunicationEventType,
    templateKey: String(row.template_key) as CommunicationTemplateKey,
    audienceType: String(row.audience_type) as "student" | "guardian" | "staff_role",
    channels: Array.isArray(row.channels)
      ? (row.channels as CommunicationChannel[])
      : ["in_app"],
    essential: Boolean(row.essential),
    active: Boolean(row.active),
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at),
  };
}

export async function listTriggers(
  tenantId: string,
  database: CommunicationTriggersDatabase,
): Promise<CommunicationTrigger[]> {
  const result = await database.query(
    `select id, tenant_id, event_type, template_key, audience_type, channels, essential, active, created_at, updated_at
       from academy_communication_triggers
      where tenant_id = $1
      order by event_type asc, template_key asc`,
    [tenantId],
  );
  return result.rows.map(mapTrigger);
}

export async function upsertTrigger(
  actor: AcademyActor,
  input: UpsertTriggerInput,
  database: CommunicationTriggersDatabase,
): Promise<CommunicationTrigger> {
  assertInstitutionAdmin(actor);

  const result = await database.query(
    `insert into academy_communication_triggers (
       tenant_id,
       event_type,
       template_key,
       audience_type,
       channels,
       essential,
       active
     ) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (tenant_id, event_type, template_key)
     do update set
       audience_type = excluded.audience_type,
       channels = excluded.channels,
       essential = excluded.essential,
       active = excluded.active,
       updated_at = now()
     returning id, tenant_id, event_type, template_key, audience_type, channels, essential, active, created_at, updated_at`,
    [
      actor.tenantId,
      input.eventType,
      input.templateKey,
      input.audienceType,
      input.channels,
      input.essential,
      input.active,
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Failed to upsert communication trigger.");
  }

  return mapTrigger(result.rows[0]);
}

export async function fireCommunicationEvent(
  payload: CommunicationEventPayload,
  communicationsService: Pick<CommunicationsService, "createCommunication">,
  database: CommunicationTriggersDatabase,
): Promise<{ fired: number }> {
  const triggers = await database.query(
    `select id, tenant_id, event_type, template_key, audience_type, channels, essential, active, created_at, updated_at
       from academy_communication_triggers
      where tenant_id = $1
        and event_type = $2
        and active = true
      order by template_key asc`,
    [payload.tenantId, payload.eventType],
  );

  let fired = 0;

  for (const row of triggers.rows) {
    try {
      const trigger = mapTrigger(row);

      const audience: CommunicationAudience =
        trigger.audienceType === "student"
          ? { type: "student", personId: payload.studentPersonId }
          : trigger.audienceType === "guardian"
            ? { type: "guardian", studentPersonId: payload.studentPersonId }
            : { type: "staff_role", roles: ["institution_admin"] };

      const systemActor: AcademyActor = {
        tenantId: payload.tenantId,
        userId: "system",
        roles: ["institution_admin"],
      };

      const idempotencyKey = `${payload.eventType}:${payload.sourceId}:${trigger.templateKey}`;

      await communicationsService.createCommunication(systemActor, {
        templateKey: trigger.templateKey,
        audience,
        channels: trigger.channels,
        variables: payload.variables,
        sourceType: "workflow",
        sourceId: payload.sourceId,
        idempotencyKey,
        essential: trigger.essential,
        sendAt: payload.sendAt,
      });

      fired += 1;
    } catch (error) {
      console.error(
        `Failed to fire trigger for event ${payload.eventType}, template ${row.template_key}:`,
        error,
      );
      // Swallow individual trigger failures so one bad trigger doesn't block the domain event
    }
  }

  return { fired };
}
