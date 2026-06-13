import { getDatabasePool } from "@/lib/database";
import {
  AcademyAuditEvent,
  AcademyAuditEventInput,
} from "@/modules/audit/types";

interface AuditRow {
  id: string;
  occurred_at: Date | string;
}

interface AuditQuery {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: AuditRow[] }>;
}

const prohibitedMetadataKey =
  /token|secret|password|authorization|raw|payload/i;

export function validateAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(metadata)) {
    if (prohibitedMetadataKey.test(key)) {
      throw new Error(`Audit metadata contains prohibited key: ${key}.`);
    }
  }

  return metadata;
}

export class PostgresAcademyAuditRepository {
  constructor(private readonly database: AuditQuery = getDatabasePool()) {}

  async append(input: AcademyAuditEventInput): Promise<AcademyAuditEvent> {
    const redactedMetadata = validateAuditMetadata(
      input.redactedMetadata ?? {},
    );
    const result = await this.database.query(
      `insert into academy_audit_events (
         tenant_id,
         actor_person_id,
         actor_external_subject,
         action,
         entity_type,
         entity_id,
         result_status,
         correlation_id,
         idempotency_key,
         redacted_metadata
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       returning id, occurred_at`,
      [
        input.tenantId,
        input.actorPersonId ?? null,
        input.actorExternalSubject ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        input.resultStatus,
        input.correlationId ?? null,
        input.idempotencyKey ?? null,
        JSON.stringify(redactedMetadata),
      ],
    );
    const row = result.rows[0];

    return {
      ...input,
      id: row.id,
      occurredAt:
        row.occurred_at instanceof Date
          ? row.occurred_at.toISOString()
          : row.occurred_at,
      redactedMetadata,
    };
  }
}
