import { getDatabasePool } from "@/lib/database";

export type LmsSandboxCheckProvider = "moodle" | "canvas";
export type LmsSandboxCheckStatus = "passed" | "failed" | "skipped";

export interface LmsSandboxCheckResultRecord {
  id: string;
  tenantId: string;
  providerId: LmsSandboxCheckProvider;
  checkKey: string;
  checkLabel: string;
  status: LmsSandboxCheckStatus;
  safeSummary: string;
  reference: string;
  durationMs: number;
  runByPersonId: string;
  runAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordLmsSandboxCheckResultInput {
  providerId: LmsSandboxCheckProvider;
  checkKey: string;
  checkLabel: string;
  status: LmsSandboxCheckStatus;
  safeSummary: string;
  reference: string;
  durationMs: number;
}

export interface LmsReadinessSandboxCheckItem {
  checkKey: string;
  label: string;
  status: LmsSandboxCheckStatus;
  summary: string;
  reference: string;
  runAt: string;
  durationMs: number;
}

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface LmsSandboxCheckResultDatabase {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
}

const secretPattern = /token|secret|password|clientSecret|accessToken|rawProviderPayload|client_secret|access_token|refresh_token/i;

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function requireText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid LMS sandbox check result ${fieldName}.`);
  }
  return value.trim();
}

function assertNoSecrets(...values: string[]) {
  if (values.some((value) => secretPattern.test(value))) {
    throw new Error("Invalid LMS sandbox check result: must not include provider secrets.");
  }
}

export function normalizeSandboxCheckResultInput(
  input: RecordLmsSandboxCheckResultInput,
): RecordLmsSandboxCheckResultInput {
  if (input.providerId !== "moodle" && input.providerId !== "canvas") {
    throw new Error("Invalid LMS sandbox check result provider.");
  }
  if (input.status !== "passed" && input.status !== "failed" && input.status !== "skipped") {
    throw new Error("Invalid LMS sandbox check result status.");
  }
  if (!Number.isInteger(input.durationMs) || input.durationMs < 0) {
    throw new Error("Invalid LMS sandbox check result duration.");
  }

  const checkKey = requireText(input.checkKey, "key");
  const checkLabel = requireText(input.checkLabel, "label");
  const safeSummary = requireText(input.safeSummary, "summary");
  const reference = requireText(input.reference, "reference");
  assertNoSecrets(checkKey, checkLabel, safeSummary, reference);

  return {
    providerId: input.providerId,
    checkKey,
    checkLabel,
    status: input.status,
    safeSummary,
    reference,
    durationMs: input.durationMs,
  };
}

function mapResultRow(row: Record<string, unknown>): LmsSandboxCheckResultRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    providerId: String(row.provider_id) as LmsSandboxCheckProvider,
    checkKey: String(row.check_key),
    checkLabel: String(row.check_label),
    status: String(row.check_status) as LmsSandboxCheckStatus,
    safeSummary: String(row.safe_summary),
    reference: String(row.reference),
    durationMs: Number(row.duration_ms),
    runByPersonId: String(row.run_by_person_id),
    runAt: toIso(row.run_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export class PostgresLmsSandboxCheckResultRepository {
  constructor(
    private readonly database: LmsSandboxCheckResultDatabase = getDatabasePool() as LmsSandboxCheckResultDatabase,
  ) {}

  async listLatestResults(tenantId: string): Promise<LmsSandboxCheckResultRecord[]> {
    const result = await this.database.query(
      `select id, tenant_id, provider_id, check_key, check_label, check_status,
              safe_summary, reference, duration_ms, run_by_person_id, run_at, created_at, updated_at
         from academy_lms_sandbox_check_results
        where tenant_id = $1
        order by provider_id asc, check_key asc`,
      [tenantId],
    );
    return result.rows.map(mapResultRow);
  }

  async recordResult(
    tenantId: string,
    runByPersonId: string,
    input: RecordLmsSandboxCheckResultInput,
  ): Promise<LmsSandboxCheckResultRecord> {
    const normalized = normalizeSandboxCheckResultInput(input);
    const result = await this.database.query(
      `insert into academy_lms_sandbox_check_results (
         tenant_id, provider_id, check_key, check_label, check_status,
         safe_summary, reference, duration_ms, run_by_person_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (tenant_id, provider_id, check_key)
       do update set
         check_label = excluded.check_label,
         check_status = excluded.check_status,
         safe_summary = excluded.safe_summary,
         reference = excluded.reference,
         duration_ms = excluded.duration_ms,
         run_by_person_id = excluded.run_by_person_id,
         run_at = now(),
         updated_at = now()
       returning id, tenant_id, provider_id, check_key, check_label, check_status,
                 safe_summary, reference, duration_ms, run_by_person_id, run_at, created_at, updated_at`,
      [
        tenantId,
        normalized.providerId,
        normalized.checkKey,
        normalized.checkLabel,
        normalized.status,
        normalized.safeSummary,
        normalized.reference,
        normalized.durationMs,
        runByPersonId,
      ],
    );

    if (!result.rows[0]) throw new Error("Invalid LMS sandbox check result save result.");
    return mapResultRow(result.rows[0]);
  }
}

export function groupLmsSandboxCheckResultsForReadiness(
  records: LmsSandboxCheckResultRecord[],
): Partial<Record<LmsSandboxCheckProvider, LmsReadinessSandboxCheckItem[]>> {
  return records.reduce<Partial<Record<LmsSandboxCheckProvider, LmsReadinessSandboxCheckItem[]>>>((grouped, record) => {
    const items = grouped[record.providerId] ?? [];
    items.push({
      checkKey: record.checkKey,
      label: record.checkLabel,
      status: record.status,
      summary: record.safeSummary,
      reference: record.reference,
      runAt: record.runAt,
      durationMs: record.durationMs,
    });
    grouped[record.providerId] = items;
    return grouped;
  }, {});
}
