import { getDatabasePool } from "@/lib/database";
import {
  DemoFeedbackAction,
  DemoFeedbackCategory,
  DemoFeedbackIdentity,
  DemoFeedbackStoredRecord,
  DemoFeedbackSubmission,
  DemoFeedbackTriageFilters,
  DemoFeedbackTriageUpdate,
} from "@/modules/demo-feedback/types";

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

interface SubmitResult {
  status: "accepted" | "rate_limited";
  record: DemoFeedbackStoredRecord | null;
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapRow(row: Record<string, unknown>): DemoFeedbackStoredRecord {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    sessionId: String(row.session_id),
    route: String(row.route),
    category: row.category as DemoFeedbackCategory,
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    note: typeof row.note === "string" ? row.note : null,
    breadcrumbs: Array.isArray(row.breadcrumbs) ? (row.breadcrumbs as string[]) : [],
    userEmail: typeof row.user_email === "string" ? row.user_email : null,
    userRole: typeof row.user_role === "string" ? row.user_role : null,
    demoVersion: String(row.demo_version),
    sessionDurationSeconds: typeof row.session_duration_seconds === "number" ? row.session_duration_seconds : null,
    hitCount: Number(row.hit_count),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    processed: Boolean(row.processed),
    action: (row.action as DemoFeedbackAction | null) ?? null,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export class DemoFeedbackPostgresRepository {
  constructor(private readonly pool: Queryable = getDatabasePool()) {}

  async submitFeedback(input: DemoFeedbackSubmission, identity: DemoFeedbackIdentity, fingerprint: string): Promise<SubmitResult> {
    const result = await this.pool.query(
      `select * from academy_submit_demo_feedback(
         p_session_id => $1::uuid,
         p_route => $2,
         p_category => $3,
         p_error_message => $4,
         p_note => $5,
         p_breadcrumbs => $6::jsonb,
         p_user_email => $7,
         p_user_role => $8,
         p_demo_version => $9,
         p_session_duration_seconds => $10,
         p_fingerprint => $11,
         p_metadata => $12::jsonb
       )`,
      [
        input.sessionId,
        input.route,
        input.category,
        input.errorMessage,
        input.note,
        JSON.stringify(input.breadcrumbs),
        identity.userEmail,
        identity.userRole,
        input.demoVersion,
        input.sessionDurationSeconds,
        fingerprint,
        JSON.stringify({ source: "demo-feedback-api" }),
      ],
    );

    if (result.rowCount === 0) {
      return { status: "rate_limited", record: null };
    }

    const row = result.rows[0];
    const status = String(row.status) as SubmitResult["status"];
    const record = row.feedback_row ? mapRow(row.feedback_row as Record<string, unknown>) : null;

    return {
      status,
      record,
    };
  }

  async listFeedback(filters: DemoFeedbackTriageFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.status === "open") {
      where.push("processed = false");
    } else if (filters.status === "done") {
      where.push("processed = true");
    }

    if (filters.category) {
      params.push(filters.category);
      where.push(`category = $${params.length}`);
    }

    if (filters.identity) {
      params.push(`%${filters.identity.toLowerCase()}%`);
      where.push(`(lower(coalesce(user_email, '')) like $${params.length} or lower(coalesce(user_role, '')) like $${params.length})`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`created_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`created_at <= $${params.length}::timestamptz`);
    }

    const clause = where.length > 0 ? `where ${where.join(" and ")}` : "";

    const result = await this.pool.query(
      `select * from academy_demo_feedback
       ${clause}
       order by processed asc, created_at desc`,
      params,
    );

    return result.rows.map(mapRow);
  }

  async updateFeedback(id: string, update: DemoFeedbackTriageUpdate) {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (update.processed !== undefined) {
      params.push(update.processed);
      fields.push(`processed = $${params.length}`);
    }

    if (update.action !== undefined) {
      params.push(update.action);
      fields.push(`action = $${params.length}`);
    }

    if (fields.length === 0) {
      throw new Error("At least one update field is required.");
    }

    params.push(id);

    const result = await this.pool.query(
      `update academy_demo_feedback
       set ${fields.join(", ")}, updated_at = now()
       where id = $${params.length}
       returning *`,
      params,
    );

    if (result.rowCount === 0) {
      throw new Error("Demo feedback record was not found.");
    }

    return mapRow(result.rows[0]);
  }
}
