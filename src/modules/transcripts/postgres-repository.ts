import { getDatabasePool } from "@/lib/database";
import type {
  TranscriptIssuanceRequest,
  TranscriptRecord,
  TranscriptRepository,
  TranscriptRequestInput,
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
    requestedByPersonId: row.requested_by_person_id != null
      ? String(row.requested_by_person_id)
      : undefined,
    requestedAt: row.requested_at != null
      ? (row.requested_at instanceof Date ? row.requested_at.toISOString() : String(row.requested_at))
      : undefined,
    holdReason: row.hold_reason != null ? String(row.hold_reason) : undefined,
    heldAt: row.held_at != null
      ? (row.held_at instanceof Date ? row.held_at.toISOString() : String(row.held_at))
      : undefined,
    releasedAt: row.released_at != null
      ? (row.released_at instanceof Date ? row.released_at.toISOString() : String(row.released_at))
      : undefined,
    releasedByPersonId: row.released_by_person_id != null
      ? String(row.released_by_person_id)
      : undefined,
    revokedAt: row.revoked_at != null
      ? (row.revoked_at instanceof Date ? row.revoked_at.toISOString() : String(row.revoked_at))
      : undefined,
    revokedByPersonId: row.revoked_by_person_id != null
      ? String(row.revoked_by_person_id)
      : undefined,
    idempotencyKey: String(row.idempotency_key),
    storageUrl: row.storage_url != null ? String(row.storage_url) : undefined,
  };
}

export class PostgresTranscriptRepository implements TranscriptRepository {
  constructor(
    private readonly database: TranscriptDatabase = getDatabasePool() as TranscriptDatabase,
  ) {}

  async createRequest(input: TranscriptRequestInput): Promise<TranscriptRecord> {
    const record = await this.insertTranscript(input, "requested");
    await this.writeEvent({
      tenantId: input.tenantId,
      transcriptId: record.id,
      actorPersonId: input.requestedByPersonId,
      eventType: "requested",
      previousStatus: null,
      newStatus: "requested",
      reason: input.note ?? "Transcript requested.",
    });
    return record;
  }

  async issue(input: TranscriptIssuanceRequest): Promise<TranscriptRecord> {
    const record = await this.insertTranscript(input, "issued");
    await this.writeEvent({
      tenantId: input.tenantId,
      transcriptId: record.id,
      actorPersonId: input.requestedByPersonId,
      eventType: "issued",
      previousStatus: null,
      newStatus: "issued",
      reason: input.note ?? "Transcript issued.",
    });
    return record;
  }

  private async insertTranscript(
    input: TranscriptIssuanceRequest,
    status: TranscriptRecord["status"],
  ): Promise<TranscriptRecord> {
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
         requested_by_person_id,
         requested_at,
         idempotency_key,
         issued_at
       ) values ($1, $2, $9, $3, $4, $5, $6, $7, $7, now(), $8, now())
       on conflict (tenant_id, idempotency_key) do nothing
       returning
         id, tenant_id, student_person_id, status, delivery_method,
         recipient_name, recipient_email, note, issued_at, issued_by_person_id,
         requested_by_person_id, requested_at, hold_reason, held_at,
         released_at, released_by_person_id, revoked_at, revoked_by_person_id,
         idempotency_key`,
      [
        input.tenantId,
        input.studentPersonId,
        input.deliveryMethod,
        input.recipientName ?? null,
        input.recipientEmail ?? null,
        input.note ?? null,
        input.requestedByPersonId,
        input.idempotencyKey,
        status,
      ],
    );

    if (!result.rows[0]) {
      // Idempotency replay — fetch the existing record
      const existing = await this.database.query(
        `select id, tenant_id, student_person_id, status, delivery_method,
                recipient_name, recipient_email, note, issued_at, issued_by_person_id,
                requested_by_person_id, requested_at, hold_reason, held_at,
                released_at, released_by_person_id, revoked_at, revoked_by_person_id,
                idempotency_key, storage_url
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
              requested_by_person_id, requested_at, hold_reason, held_at,
              released_at, released_by_person_id, revoked_at, revoked_by_person_id,
              idempotency_key, storage_url
         from academy_transcript_issuances
        where tenant_id = $1 and student_person_id = $2
        order by issued_at desc`,
      [tenantId, studentPersonId],
    );

    return result.rows.map(mapRow);
  }

  async findById(
    tenantId: string,
    transcriptId: string,
  ): Promise<TranscriptRecord | null> {
    const result = await this.database.query(
      `select id, tenant_id, student_person_id, status, delivery_method,
              recipient_name, recipient_email, note, issued_at, issued_by_person_id,
              requested_by_person_id, requested_at, hold_reason, held_at,
              released_at, released_by_person_id, revoked_at, revoked_by_person_id,
              idempotency_key, storage_url
         from academy_transcript_issuances
        where tenant_id = $1 and id = $2`,
      [tenantId, transcriptId],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async updateStorageUrl(
    tenantId: string,
    transcriptId: string,
    storageUrl: string,
  ): Promise<TranscriptRecord> {
    const result = await this.database.query(
      `update academy_transcript_issuances
          set storage_url = $3
        where tenant_id = $1 and id = $2
       returning id, tenant_id, student_person_id, status, delivery_method,
                 recipient_name, recipient_email, note, issued_at, issued_by_person_id,
                 requested_by_person_id, requested_at, hold_reason, held_at,
                 released_at, released_by_person_id, revoked_at, revoked_by_person_id,
                 idempotency_key, storage_url`,
      [tenantId, transcriptId, storageUrl],
    );

    if (!result.rows[0]) {
      throw new Error(`Transcript ${transcriptId} not found in tenant ${tenantId}.`);
    }

    return mapRow(result.rows[0]);
  }

  async hold(
    tenantId: string,
    transcriptId: string,
    heldByPersonId: string,
    reason: string,
  ): Promise<TranscriptRecord> {
    return this.transitionTranscript({
      tenantId,
      transcriptId,
      actorPersonId: heldByPersonId,
      eventType: "held",
      newStatus: "held",
      reason,
      setClause: "hold_reason = $4, held_at = now()",
      allowedStatuses: ["requested", "issued", "released"],
    });
  }

  async release(
    tenantId: string,
    transcriptId: string,
    releasedByPersonId: string,
    reason: string,
  ): Promise<TranscriptRecord> {
    return this.transitionTranscript({
      tenantId,
      transcriptId,
      actorPersonId: releasedByPersonId,
      eventType: "released",
      newStatus: "released",
      reason,
      setClause: "released_at = now(), released_by_person_id = $3",
      allowedStatuses: ["held", "issued"],
    });
  }

  async revoke(
    tenantId: string,
    transcriptId: string,
    revokedByPersonId: string,
    reason: string,
  ): Promise<TranscriptRecord> {
    return this.transitionTranscript({
      tenantId,
      transcriptId,
      actorPersonId: revokedByPersonId,
      eventType: "revoked",
      newStatus: "revoked",
      reason,
      setClause: "revoked_at = now(), revoked_by_person_id = $3",
      allowedStatuses: ["issued", "released", "held"],
    });
  }

  async hasPostedTranscriptRecords(
    tenantId: string,
    studentPersonId: string,
  ): Promise<boolean> {
    const result = await this.database.query(
      `select true as has_records
         from public.academy_gradebook_records record
         join public.academy_gradebook_assignments assignment
           on assignment.tenant_id = record.tenant_id
          and assignment.id = record.assignment_id
         join public.academy_courses course
           on course.tenant_id = assignment.tenant_id
          and course.id = assignment.course_id
        where record.tenant_id = $1
          and record.learner_person_id = $2
          and record.posting_status = 'posted'
          and record.released_to_student_at is not null
          and course.record_type = 'transcript'
        limit 1`,
      [tenantId, studentPersonId],
    );
    return Boolean(result.rows[0]);
  }

  async hasActiveTranscriptHold(
    tenantId: string,
    studentPersonId: string,
  ): Promise<boolean> {
    const result = await this.database.query(
      `select true as has_hold
         from academy_transcript_issuances
        where tenant_id = $1
          and student_person_id = $2
          and status = 'held'
        limit 1`,
      [tenantId, studentPersonId],
    );
    return Boolean(result.rows[0]);
  }

  private async transitionTranscript(input: {
    tenantId: string;
    transcriptId: string;
    actorPersonId: string;
    eventType: "held" | "released" | "revoked";
    newStatus: TranscriptRecord["status"];
    reason: string;
    setClause: string;
    allowedStatuses: TranscriptRecord["status"][];
  }): Promise<TranscriptRecord> {
    const existing = await this.database.query(
      `select status
         from academy_transcript_issuances
        where tenant_id = $1 and id = $2
        for update`,
      [input.tenantId, input.transcriptId],
    );
    const previousStatus = existing.rows[0]?.status
      ? String(existing.rows[0].status)
      : undefined;
    if (!previousStatus || !input.allowedStatuses.includes(previousStatus as TranscriptRecord["status"])) {
      throw new Error(
        `Transcript ${input.transcriptId} was not found or cannot transition to ${input.newStatus}.`,
      );
    }

    const result = await this.database.query(
      `update academy_transcript_issuances
          set status = $5,
              ${input.setClause}
        where tenant_id = $1 and id = $2
       returning
         id, tenant_id, student_person_id, status, delivery_method,
         recipient_name, recipient_email, note, issued_at, issued_by_person_id,
         requested_by_person_id, requested_at, hold_reason, held_at,
         released_at, released_by_person_id, revoked_at, revoked_by_person_id,
         idempotency_key`,
      [
        input.tenantId,
        input.transcriptId,
        input.actorPersonId,
        input.reason,
        input.newStatus,
      ],
    );

    await this.writeEvent({
      tenantId: input.tenantId,
      transcriptId: input.transcriptId,
      actorPersonId: input.actorPersonId,
      eventType: input.eventType,
      previousStatus,
      newStatus: input.newStatus,
      reason: input.reason,
    });

    return mapRow(result.rows[0]);
  }

  private async writeEvent(input: {
    tenantId: string;
    transcriptId: string;
    actorPersonId: string;
    eventType: string;
    previousStatus: string | null;
    newStatus: string;
    reason: string;
  }) {
    await this.database.query(
      `insert into academy_transcript_events (
         tenant_id,
         transcript_id,
         actor_person_id,
         event_type,
         previous_status,
         new_status,
         reason
       ) values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.tenantId,
        input.transcriptId,
        input.actorPersonId,
        input.eventType,
        input.previousStatus,
        input.newStatus,
        input.reason,
      ],
    );
  }
}
