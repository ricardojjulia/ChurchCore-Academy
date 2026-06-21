import { getDatabasePool } from "@/lib/database";
import type {
  CommunicationDirectory,
  CommunicationMessage,
  CommunicationsRepository,
} from "@/modules/communications/types";
import type { AcademyRole } from "@/modules/academy-auth/policy";

interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface CommunicationsDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function asIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapMessage(row: Record<string, unknown>): CommunicationMessage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    recipientPersonId: String(row.recipient_person_id),
    recipientDisplayName: String(row.recipient_display_name ?? row.display_name ?? ""),
    recipientEmail:
      row.recipient_email != null
        ? String(row.recipient_email)
        : row.email != null
          ? String(row.email)
          : undefined,
    relatedStudentPersonId:
      row.related_student_person_id != null ? String(row.related_student_person_id) : undefined,
    channel: String(row.channel) as CommunicationMessage["channel"],
    templateKey: String(row.template_key) as CommunicationMessage["templateKey"],
    subject: String(row.subject),
    body: String(row.body),
    status: String(row.status) as CommunicationMessage["status"],
    sourceType: String(row.source_type) as CommunicationMessage["sourceType"],
    sourceId: String(row.source_id),
    idempotencyKey: String(row.idempotency_key),
    retryCount: Number(row.retry_count),
    providerReference: row.provider_reference != null ? String(row.provider_reference) : undefined,
    failureReason: row.failure_reason != null ? String(row.failure_reason) : undefined,
    createdAt: asIso(row.created_at),
    sentAt: row.sent_at != null ? asIso(row.sent_at) : undefined,
    readAt: row.read_at != null ? asIso(row.read_at) : undefined,
  };
}

export class PostgresCommunicationsRepository implements CommunicationsRepository {
  constructor(
    private readonly database: CommunicationsDatabase = getDatabasePool() as CommunicationsDatabase,
  ) {}

  async loadDirectory(tenantId: string): Promise<CommunicationDirectory> {
    const people = await this.database.query(
      `select
         person.id,
         person.display_name,
         person.email,
         coalesce(array_agg(role.role) filter (where role.status = 'active'), '{}'::text[]) as roles
       from academy_people person
       left join academy_person_role_assignments role
         on role.tenant_id = person.tenant_id
        and role.person_id = person.id
       where person.tenant_id = $1
         and person.person_status = 'active'
       group by person.id, person.display_name, person.email
       order by person.display_name asc`,
      [tenantId],
    );

    const relationships = await this.database.query(
      `select student_person_id, related_person_id, relationship_type, visibility, status
         from academy_student_relationships
        where tenant_id = $1
          and status = 'active'
        order by related_person_id asc`,
      [tenantId],
    );

    const preferences = await this.database.query(
      `select person_id
         from academy_communication_preferences
        where tenant_id = $1
          and channel = 'email'
          and opted_out = true`,
      [tenantId],
    );

    return {
      people: people.rows.map((row) => ({
        id: String(row.id),
        displayName: String(row.display_name),
        email: row.email != null ? String(row.email) : undefined,
        roles: Array.isArray(row.roles) ? (row.roles as AcademyRole[]) : [],
      })),
      relationships: relationships.rows.map((row) => ({
        studentPersonId: String(row.student_person_id),
        relatedPersonId: String(row.related_person_id),
        relationshipType: String(row.relationship_type),
        visibility: String(row.visibility),
        status: String(row.status),
      })),
      emailOptOutPersonIds: preferences.rows.map((row) => String(row.person_id)),
    };
  }

  async findByIdempotencyKey(tenantId: string, idempotencyKey: string) {
    const result = await this.database.query(
      `select
         message.*,
         person.display_name as recipient_display_name,
         person.email as recipient_email
       from academy_communication_messages message
       join academy_people person
         on person.tenant_id = message.tenant_id
        and person.id = message.recipient_person_id
       where message.tenant_id = $1
         and message.idempotency_key = $2
       order by message.created_at asc`,
      [tenantId, idempotencyKey],
    );
    return result.rows.map(mapMessage);
  }

  async enqueueMessages(messages: CommunicationMessage[], auditEvents: string[]) {
    const queued: CommunicationMessage[] = [];

    for (const message of messages) {
      const inserted = await this.database.query(
        `insert into academy_communication_messages (
           id,
           tenant_id,
           recipient_person_id,
           related_student_person_id,
           channel,
           template_key,
           subject,
           body,
           status,
           source_type,
           source_id,
           idempotency_key,
           retry_count,
           created_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'queued', $9, $10, $11, $12, $13)
         on conflict (tenant_id, recipient_person_id, channel, idempotency_key) do nothing
         returning *`,
        [
          message.id,
          message.tenantId,
          message.recipientPersonId,
          message.relatedStudentPersonId ?? null,
          message.channel,
          message.templateKey,
          message.subject,
          message.body,
          message.sourceType,
          message.sourceId,
          message.idempotencyKey,
          message.retryCount,
          message.createdAt,
        ],
      );

      if (inserted.rows[0]) {
        const person = await this.database.query(
          `select display_name, email
             from academy_people
            where tenant_id = $1 and id = $2`,
          [message.tenantId, message.recipientPersonId],
        );
        queued.push(mapMessage({ ...inserted.rows[0], ...person.rows[0] }));
      }
    }

    for (const message of queued) {
      await this.database.query(
        `insert into academy_communication_audit_events (
           tenant_id,
           message_id,
           event_type,
           actor_person_id,
           note
         ) values ($1, $2, $3, null, null)`,
        [message.tenantId, message.id, auditEvents[0] ?? "queued"],
      );
    }

    return queued.length > 0
      ? queued
      : this.findByIdempotencyKey(messages[0]?.tenantId ?? "", messages[0]?.idempotencyKey ?? "");
  }

  async listMessages(tenantId: string, recipientPersonId?: string) {
    const result = await this.database.query(
      `select
         message.*,
         person.display_name as recipient_display_name,
         person.email as recipient_email
       from academy_communication_messages message
       join academy_people person
         on person.tenant_id = message.tenant_id
        and person.id = message.recipient_person_id
       where message.tenant_id = $1
         and ($2::text is null or message.recipient_person_id = $2)
       order by message.created_at desc
       limit 100`,
      [tenantId, recipientPersonId ?? null],
    );
    return result.rows.map(mapMessage);
  }

  async markRead(tenantId: string, messageId: string, recipientPersonId: string) {
    const result = await this.database.query(
      `update academy_communication_messages
          set status = 'read',
              read_at = coalesce(read_at, now())
        where tenant_id = $1
          and id = $2
          and recipient_person_id = $3
       returning *`,
      [tenantId, messageId, recipientPersonId],
    );
    if (!result.rows[0]) {
      throw new Error(`Communication message ${messageId} was not found.`);
    }

    await this.database.query(
      `insert into academy_communication_audit_events (
         tenant_id,
         message_id,
         event_type,
         actor_person_id
       ) values ($1, $2, 'read', $3)`,
      [tenantId, messageId, recipientPersonId],
    );

    const person = await this.database.query(
      `select display_name, email from academy_people where tenant_id = $1 and id = $2`,
      [tenantId, recipientPersonId],
    );
    return mapMessage({ ...result.rows[0], ...person.rows[0] });
  }

  async markProviderFailure(tenantId: string, messageId: string, reason: string) {
    const result = await this.database.query(
      `update academy_communication_messages
          set status = 'failed',
              retry_count = retry_count + 1,
              failure_reason = $3
        where tenant_id = $1
          and id = $2
       returning *`,
      [tenantId, messageId, reason],
    );
    if (!result.rows[0]) {
      throw new Error(`Communication message ${messageId} was not found.`);
    }

    await this.database.query(
      `insert into academy_communication_audit_events (
         tenant_id,
         message_id,
         event_type,
         note
       ) values ($1, $2, 'failed', $3)`,
      [tenantId, messageId, reason],
    );

    const person = await this.database.query(
      `select display_name, email from academy_people where tenant_id = $1 and id = $2`,
      [tenantId, String(result.rows[0].recipient_person_id)],
    );
    return mapMessage({ ...result.rows[0], ...person.rows[0] });
  }
}
