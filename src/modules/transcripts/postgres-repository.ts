import { getDatabasePool } from "@/lib/database";
import type {
  TranscriptIssuanceRequest,
  TranscriptRecord,
  TranscriptRepository,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface TranscriptDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function mapRow(row: Record<string, unknown>): TranscriptRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    status: String(row.status) as TranscriptRecord["status"],
    deliveryMethod: String(row.delivery_method) as TranscriptRecord["deliveryMethod"],
    recipientName: row.recipient_name != null ? String(row.recipient_name) : undefined,
    recipientEmail: row.recipient_email != null ? String(row.recipient_email) : undefined,
    note: row.note != null ? String(row.note) : undefined,
    issuedAt: row.issued_at instanceof Date
      ? row.issued_at.toISOString()
      : String(row.issued_at),
    issuedByPersonId: String(row.issued_by_person_id),
    revokedAt: row.revoked_at != null
      ? (row.revoked_at instanceof Date ? row.revoked_at.toISOString() : String(row.revoked_at))
      : undefined,
    idempotencyKey: String(row.idempotency_key),
  };
}

export class PostgresTranscriptRepository implements TranscriptRepository {
  constructor(
    private readonly database: TranscriptDatabase = getDatabasePool() as TranscriptDatabase,
  ) {}

  async issue(input: TranscriptIssuanceRequest): Promise<TranscriptRecord> {
    const result = await this.database.query(
      `insert into academy_transcript_issuances (
         tenant_id,
         student_person_id,
         status,
         delivery_method,
         recipient_name,
         recipient_email,
         note,
         issued_by_person_id,
         idempotency_key,
         issued_at
       ) values ($1, $2, 'issued', $3, $4, $5, $6, $7, $8, now())
       on conflict (tenant_id, idempotency_key) do nothing
       returning
         id, tenant_id, student_person_id, status, delivery_method,
         recipient_name, recipient_email, note, issued_at, issued_by_person_id,
         revoked_at, idempotency_key`,
      [
        input.tenantId,
        input.studentPersonId,
        input.deliveryMethod,
        input.recipientName ?? null,
        input.recipientEmail ?? null,
        input.note ?? null,
        input.requestedByPersonId,
        input.idempotencyKey,
      ],
    );

    if (!result.rows[0]) {
      // Idempotency replay — fetch the existing record
      const existing = await this.database.query(
        `select id, tenant_id, student_person_id, status, delivery_method,
                recipient_name, recipient_email, note, issued_at, issued_by_person_id,
                revoked_at, idempotency_key
           from academy_transcript_issuances
          where tenant_id = $1 and idempotency_key = $2`,
        [input.tenantId, input.idempotencyKey],
      );

      if (!existing.rows[0]) {
        throw new Error("Transcript issuance failed unexpectedly.");
      }

      return mapRow(existing.rows[0]);
    }

    return mapRow(result.rows[0]);
  }

  async findByStudent(
    tenantId: string,
    studentPersonId: string,
  ): Promise<TranscriptRecord[]> {
    const result = await this.database.query(
      `select id, tenant_id, student_person_id, status, delivery_method,
              recipient_name, recipient_email, note, issued_at, issued_by_person_id,
              revoked_at, idempotency_key
         from academy_transcript_issuances
        where tenant_id = $1 and student_person_id = $2
        order by issued_at desc`,
      [tenantId, studentPersonId],
    );

    return result.rows.map(mapRow);
  }

  async revoke(
    tenantId: string,
    transcriptId: string,
    revokedByPersonId: string,
  ): Promise<TranscriptRecord> {
    const result = await this.database.query(
      `update academy_transcript_issuances
          set status = 'revoked',
              revoked_at = now(),
              revoked_by_person_id = $3
        where tenant_id = $1 and id = $2 and status = 'issued'
       returning
         id, tenant_id, student_person_id, status, delivery_method,
         recipient_name, recipient_email, note, issued_at, issued_by_person_id,
         revoked_at, idempotency_key`,
      [tenantId, transcriptId, revokedByPersonId],
    );

    if (!result.rows[0]) {
      throw new Error(
        `Transcript ${transcriptId} was not found or is not in issued status.`,
      );
    }

    return mapRow(result.rows[0]);
  }
}
