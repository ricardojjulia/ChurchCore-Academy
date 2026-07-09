import { getDatabasePool } from "@/lib/database";
import type {
  LmsReadinessEvidenceItem,
  LmsReadinessEvidenceStatus,
} from "@/modules/lms-contract/provider-readiness";

export type LmsSandboxEvidenceProvider = "moodle" | "canvas";
export type LmsSandboxEvidenceStatus = LmsReadinessEvidenceStatus;

export interface LmsSandboxEvidenceRecord {
  id: string;
  tenantId: string;
  providerId: LmsSandboxEvidenceProvider;
  evidenceLabel: string;
  status: LmsSandboxEvidenceStatus;
  reference: string;
  notes?: string;
  recordedByPersonId: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordLmsSandboxEvidenceInput {
  providerId: LmsSandboxEvidenceProvider;
  evidenceLabel: string;
  status: LmsSandboxEvidenceStatus;
  reference: string;
  notes?: string;
}

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface LmsSandboxEvidenceDatabase {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
}

const secretPattern = /token|secret|password|clientSecret|accessToken|rawProviderPayload/i;

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function optionalText(value: unknown) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function requireText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid LMS sandbox evidence ${fieldName}.`);
  }
  return value.trim();
}

function assertNoSecrets(reference: string, notes?: string) {
  if (secretPattern.test(reference) || (notes && secretPattern.test(notes))) {
    throw new Error("Invalid LMS sandbox evidence: must not include provider secrets.");
  }
}

export function normalizeSandboxEvidenceInput(input: RecordLmsSandboxEvidenceInput): RecordLmsSandboxEvidenceInput {
  if (input.providerId !== "moodle" && input.providerId !== "canvas") {
    throw new Error("Invalid LMS sandbox evidence provider.");
  }
  if (input.status !== "pending" && input.status !== "recorded") {
    throw new Error("Invalid LMS sandbox evidence status.");
  }

  const evidenceLabel = requireText(input.evidenceLabel, "label");
  const reference = requireText(input.reference, "reference");
  const notes = optionalText(input.notes);
  assertNoSecrets(reference, notes);

  return {
    providerId: input.providerId,
    evidenceLabel,
    status: input.status,
    reference,
    notes,
  };
}

function mapEvidenceRow(row: Record<string, unknown>): LmsSandboxEvidenceRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    providerId: String(row.provider_id) as LmsSandboxEvidenceProvider,
    evidenceLabel: String(row.evidence_label),
    status: String(row.evidence_status) as LmsSandboxEvidenceStatus,
    reference: String(row.reference),
    notes: optionalText(row.notes),
    recordedByPersonId: String(row.recorded_by_person_id),
    recordedAt: toIso(row.recorded_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export class PostgresLmsSandboxEvidenceRepository {
  constructor(
    private readonly database: LmsSandboxEvidenceDatabase = getDatabasePool() as LmsSandboxEvidenceDatabase,
  ) {}

  async listEvidence(tenantId: string): Promise<LmsSandboxEvidenceRecord[]> {
    const result = await this.database.query(
      `select id, tenant_id, provider_id, evidence_label, evidence_status,
              reference, notes, recorded_by_person_id, recorded_at, created_at, updated_at
         from academy_lms_sandbox_evidence
        where tenant_id = $1
        order by provider_id asc, evidence_label asc`,
      [tenantId],
    );
    return result.rows.map(mapEvidenceRow);
  }

  async recordEvidence(
    tenantId: string,
    recordedByPersonId: string,
    input: RecordLmsSandboxEvidenceInput,
  ): Promise<LmsSandboxEvidenceRecord> {
    const normalized = normalizeSandboxEvidenceInput(input);
    const result = await this.database.query(
      `insert into academy_lms_sandbox_evidence (
         tenant_id, provider_id, evidence_label, evidence_status,
         reference, notes, recorded_by_person_id
       ) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (tenant_id, provider_id, evidence_label)
       do update set
         evidence_status = excluded.evidence_status,
         reference = excluded.reference,
         notes = excluded.notes,
         recorded_by_person_id = excluded.recorded_by_person_id,
         recorded_at = now(),
         updated_at = now()
       returning id, tenant_id, provider_id, evidence_label, evidence_status,
                 reference, notes, recorded_by_person_id, recorded_at, created_at, updated_at`,
      [
        tenantId,
        normalized.providerId,
        normalized.evidenceLabel,
        normalized.status,
        normalized.reference,
        normalized.notes ?? null,
        recordedByPersonId,
      ],
    );

    if (!result.rows[0]) throw new Error("Invalid LMS sandbox evidence save result.");
    return mapEvidenceRow(result.rows[0]);
  }
}

export function groupLmsSandboxEvidenceForReadiness(
  records: LmsSandboxEvidenceRecord[],
): Partial<Record<LmsSandboxEvidenceProvider, LmsReadinessEvidenceItem[]>> {
  return records.reduce<Partial<Record<LmsSandboxEvidenceProvider, LmsReadinessEvidenceItem[]>>>((grouped, record) => {
    const items = grouped[record.providerId] ?? [];
    items.push({
      label: record.evidenceLabel,
      status: record.status,
      reference: record.reference,
    });
    grouped[record.providerId] = items;
    return grouped;
  }, {});
}
