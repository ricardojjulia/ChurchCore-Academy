import { getDatabasePool } from "@/lib/database";
import type { LmsReadinessEvidenceItem } from "@/modules/lms-contract/provider-readiness";
import type {
  LmsReadinessSandboxCheckItem,
  LmsSandboxCheckProvider,
} from "@/modules/lms-contract/sandbox-check-results";

export type LmsActivationRequestStatus = "requested" | "approved" | "rejected";

export interface LmsActivationRequestRecord {
  id: string;
  tenantId: string;
  providerId: LmsSandboxCheckProvider;
  status: LmsActivationRequestStatus;
  safeSummary: string;
  evidenceSnapshot: string[];
  requestedByPersonId: string;
  requestedAt: string;
  decidedByPersonId?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestLmsActivationInput {
  providerId: LmsSandboxCheckProvider;
  safeSummary: string;
  evidenceSnapshot: string[];
}

export interface LmsActivationEligibilityInput {
  providerId: LmsSandboxCheckProvider;
  evidence: LmsReadinessEvidenceItem[];
  checkResults: LmsReadinessSandboxCheckItem[];
}

export interface LmsActivationEligibilityResult {
  eligible: boolean;
  blockers: string[];
  evidenceSnapshot: string[];
}

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface LmsActivationRequestDatabase {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
}

const secretPattern = /token|secret|password|clientSecret|accessToken|refreshToken|rawProviderPayload|client_secret|access_token|refresh_token/i;
const requiredCheckKeys = ["configuration_review", "roster_preview", "launch_smoke"];
const providerName: Record<LmsSandboxCheckProvider, string> = {
  moodle: "Moodle",
  canvas: "Canvas",
};

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
    throw new Error(`Invalid LMS activation request ${fieldName}.`);
  }
  return value.trim();
}

function assertNoSecrets(...values: string[]) {
  if (values.some((value) => secretPattern.test(value))) {
    throw new Error("Invalid LMS activation request: must not include provider secrets.");
  }
}

function evidenceSnapshotFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
}

export function normalizeActivationRequestInput(input: RequestLmsActivationInput): RequestLmsActivationInput {
  if (input.providerId !== "moodle" && input.providerId !== "canvas") {
    throw new Error("Invalid LMS activation request provider.");
  }
  const safeSummary = requireText(input.safeSummary, "summary");
  const evidenceSnapshot = evidenceSnapshotFrom(input.evidenceSnapshot);
  if (evidenceSnapshot.length === 0) {
    throw new Error("Invalid LMS activation request evidence snapshot.");
  }
  assertNoSecrets(safeSummary, ...evidenceSnapshot);
  return {
    providerId: input.providerId,
    safeSummary,
    evidenceSnapshot,
  };
}

export function normalizeDecisionNote(value: string) {
  const note = requireText(value, "decision note");
  assertNoSecrets(note);
  return note;
}

export function evaluateLmsActivationEligibility(input: LmsActivationEligibilityInput): LmsActivationEligibilityResult {
  const displayName = providerName[input.providerId];
  const evidenceSnapshot = input.evidence
    .filter((evidence) => evidence.status === "recorded")
    .map((evidence) => evidence.reference);
  const blockers: string[] = [];

  if (evidenceSnapshot.length === 0) {
    blockers.push(`Provider activation requires recorded ${displayName} sandbox evidence.`);
  }

  const results = new Map(input.checkResults.map((result) => [result.checkKey, result]));
  for (const checkKey of requiredCheckKeys) {
    const result = results.get(checkKey);
    if (!result) {
      blockers.push(`Provider activation requires ${checkKey} sandbox check.`);
      continue;
    }
    if (result.status !== "passed") {
      blockers.push(`Provider activation requires ${checkKey} must pass.`);
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    evidenceSnapshot,
  };
}

function mapActivationRow(row: Record<string, unknown>): LmsActivationRequestRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    providerId: String(row.provider_id) as LmsSandboxCheckProvider,
    status: String(row.request_status) as LmsActivationRequestStatus,
    safeSummary: String(row.safe_summary),
    evidenceSnapshot: evidenceSnapshotFrom(row.evidence_snapshot),
    requestedByPersonId: String(row.requested_by_person_id),
    requestedAt: toIso(row.requested_at),
    decidedByPersonId: optionalText(row.decided_by_person_id),
    decidedAt: row.decided_at ? toIso(row.decided_at) : undefined,
    decisionNote: optionalText(row.decision_note),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export class PostgresLmsActivationRequestRepository {
  constructor(
    private readonly database: LmsActivationRequestDatabase = getDatabasePool() as LmsActivationRequestDatabase,
  ) {}

  async listLatestRequests(tenantId: string): Promise<LmsActivationRequestRecord[]> {
    const result = await this.database.query(
      `select distinct on (provider_id)
              id, tenant_id, provider_id, request_status, safe_summary, evidence_snapshot,
              requested_by_person_id, requested_at, decided_by_person_id, decided_at,
              decision_note, created_at, updated_at
         from academy_lms_activation_requests
        where tenant_id = $1
        order by provider_id asc, updated_at desc`,
      [tenantId],
    );
    return result.rows.map(mapActivationRow);
  }

  async requestActivation(
    tenantId: string,
    requestedByPersonId: string,
    input: RequestLmsActivationInput,
  ): Promise<LmsActivationRequestRecord> {
    const normalized = normalizeActivationRequestInput(input);
    const result = await this.database.query(
      `insert into academy_lms_activation_requests (
         tenant_id, provider_id, request_status, safe_summary, evidence_snapshot, requested_by_person_id
       ) values ($1, $2, 'requested', $3, $4::jsonb, $5)
       on conflict (tenant_id, provider_id) where request_status = 'requested'
       do update set
         safe_summary = excluded.safe_summary,
         evidence_snapshot = excluded.evidence_snapshot,
         requested_by_person_id = excluded.requested_by_person_id,
         requested_at = now(),
         updated_at = now()
       returning id, tenant_id, provider_id, request_status, safe_summary, evidence_snapshot,
                 requested_by_person_id, requested_at, decided_by_person_id, decided_at,
                 decision_note, created_at, updated_at`,
      [
        tenantId,
        normalized.providerId,
        normalized.safeSummary,
        JSON.stringify(normalized.evidenceSnapshot),
        requestedByPersonId,
      ],
    );
    if (!result.rows[0]) throw new Error("Invalid LMS activation request save result.");
    return mapActivationRow(result.rows[0]);
  }

  async approveActivation(
    tenantId: string,
    providerId: LmsSandboxCheckProvider,
    decidedByPersonId: string,
    decisionNote: string,
  ): Promise<LmsActivationRequestRecord> {
    return this.decideActivation(tenantId, providerId, "approved", decidedByPersonId, decisionNote);
  }

  async rejectActivation(
    tenantId: string,
    providerId: LmsSandboxCheckProvider,
    decidedByPersonId: string,
    decisionNote: string,
  ): Promise<LmsActivationRequestRecord> {
    return this.decideActivation(tenantId, providerId, "rejected", decidedByPersonId, decisionNote);
  }

  private async decideActivation(
    tenantId: string,
    providerId: LmsSandboxCheckProvider,
    status: Exclude<LmsActivationRequestStatus, "requested">,
    decidedByPersonId: string,
    decisionNote: string,
  ): Promise<LmsActivationRequestRecord> {
    if (providerId !== "moodle" && providerId !== "canvas") {
      throw new Error("Invalid LMS activation request provider.");
    }
    const normalizedNote = normalizeDecisionNote(decisionNote);
    const result = await this.database.query(
      `update academy_lms_activation_requests
          set request_status = '${status}',
              decided_by_person_id = $3,
              decided_at = now(),
              decision_note = $4,
              updated_at = now()
        where tenant_id = $1 and provider_id = $2 and request_status = 'requested'
        returning id, tenant_id, provider_id, request_status, safe_summary, evidence_snapshot,
                  requested_by_person_id, requested_at, decided_by_person_id, decided_at,
                  decision_note, created_at, updated_at`,
      [tenantId, providerId, decidedByPersonId, normalizedNote],
    );
    if (!result.rows[0]) throw new Error("Invalid LMS activation request decision.");
    return mapActivationRow(result.rows[0]);
  }
}

export function groupLmsActivationRequestsForReadiness(
  records: LmsActivationRequestRecord[],
): Partial<Record<LmsSandboxCheckProvider, LmsActivationRequestRecord>> {
  return records.reduce<Partial<Record<LmsSandboxCheckProvider, LmsActivationRequestRecord>>>((grouped, record) => {
    grouped[record.providerId] = record;
    return grouped;
  }, {});
}
