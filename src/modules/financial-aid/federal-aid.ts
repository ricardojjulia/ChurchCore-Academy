import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";

export type SapStandard = "meets" | "warning" | "probation" | "suspended";
export type DisbursementStatus = "pending" | "reported" | "accepted" | "rejected";
export type AppealOutcome = "approved" | "denied";

export interface FederalAidProgram {
  id: string;
  tenantId: string;
  programCode: string;
  programName: string;
  opeid?: string;
  active: boolean;
  maxAnnualAwardCents?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SapEvaluation {
  id: string;
  tenantId: string;
  studentPersonId: string;
  evaluationPeriod: string;
  evaluationDate: string;
  qualitativeStandard: SapStandard;
  quantitativeStandard: SapStandard;
  cumulativeGpa?: number;
  completionRate?: number;
  maxTimeframeCompliant: boolean;
  evaluatedByPersonId: string;
  appealFiled: boolean;
  appealOutcome?: AppealOutcome;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FederalDisbursementReport {
  id: string;
  tenantId: string;
  reportingPeriod: string;
  programCode: string;
  studentPersonId: string;
  disbursementAmountCents: number;
  disbursementDate: string;
  codReference?: string;
  status: DisbursementStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterFederalProgramInput {
  tenantId: string;
  programCode: string;
  programName: string;
  opeid?: string;
  maxAnnualAwardCents?: number;
}

export interface CreateSapEvaluationInput {
  tenantId: string;
  studentPersonId: string;
  evaluationPeriod: string;
  qualitativeStandard: SapStandard;
  quantitativeStandard: SapStandard;
  cumulativeGpa?: number;
  completionRate?: number;
  maxTimeframeCompliant?: boolean;
  notes?: string;
  evaluatedByPersonId: string;
}

export interface UpdateSapAppealInput {
  tenantId: string;
  evaluationId: string;
  appealOutcome: AppealOutcome;
}

export interface RecordFederalDisbursementInput {
  tenantId: string;
  reportingPeriod: string;
  programCode: string;
  studentPersonId: string;
  disbursementAmountCents: number;
  disbursementDate: string;
  codReference?: string;
}

export interface FederalAidDatabase {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

function assertPositiveAmount(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive integer.");
  }
}

function assertFinanceOrAdmin(actor: AcademyActor) {
  const allowed = actor.roles.some((r) =>
    ["institution_admin", "finance"].includes(r)
  );
  if (!allowed) {
    throw new AcademyAuthorizationError(
      "Forbidden federal aid program administration access."
    );
  }
}

function assertRegistrarOrAdmin(actor: AcademyActor) {
  const allowed = actor.roles.some((r) =>
    ["institution_admin", "registrar", "academic_admin"].includes(r)
  );
  if (!allowed) {
    throw new AcademyAuthorizationError("Forbidden SAP administration access.");
  }
}

function asIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asDate(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function mapProgram(row: Record<string, unknown>): FederalAidProgram {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    programCode: String(row.program_code),
    programName: String(row.program_name),
    opeid: row.opeid != null ? String(row.opeid) : undefined,
    active: Boolean(row.active),
    maxAnnualAwardCents:
      row.max_annual_award_cents != null
        ? Number(row.max_annual_award_cents)
        : undefined,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function mapSapEvaluation(row: Record<string, unknown>): SapEvaluation {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    evaluationPeriod: String(row.evaluation_period),
    evaluationDate: asDate(row.evaluation_date),
    qualitativeStandard: String(row.qualitative_standard) as SapStandard,
    quantitativeStandard: String(row.quantitative_standard) as SapStandard,
    cumulativeGpa:
      row.cumulative_gpa != null ? Number(row.cumulative_gpa) : undefined,
    completionRate:
      row.completion_rate != null ? Number(row.completion_rate) : undefined,
    maxTimeframeCompliant: Boolean(row.max_timeframe_compliant),
    evaluatedByPersonId: String(row.evaluated_by_person_id),
    appealFiled: Boolean(row.appeal_filed),
    appealOutcome:
      row.appeal_outcome != null
        ? (String(row.appeal_outcome) as AppealOutcome)
        : undefined,
    notes: row.notes != null ? String(row.notes) : undefined,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function mapDisbursementReport(
  row: Record<string, unknown>
): FederalDisbursementReport {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    reportingPeriod: String(row.reporting_period),
    programCode: String(row.program_code),
    studentPersonId: String(row.student_person_id),
    disbursementAmountCents: Number(row.disbursement_amount_cents),
    disbursementDate: asDate(row.disbursement_date),
    codReference:
      row.cod_reference != null ? String(row.cod_reference) : undefined,
    status: String(row.status) as DisbursementStatus,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export async function registerFederalProgram(
  actor: AcademyActor,
  input: {
    programCode: string;
    programName: string;
    opeid?: string;
    maxAnnualAwardCents?: number;
  },
  db: FederalAidDatabase
): Promise<FederalAidProgram> {
  assertFinanceOrAdmin(actor);

  const programCode = requireText(input.programCode, "programCode");
  const programName = requireText(input.programName, "programName");

  if (input.maxAnnualAwardCents != null) {
    assertPositiveAmount(input.maxAnnualAwardCents);
  }

  const result = await db.query(
    `insert into academy_federal_aid_programs (
       tenant_id,
       program_code,
       program_name,
       opeid,
       max_annual_award_cents
     ) values ($1, $2, $3, $4, $5)
     on conflict (tenant_id, program_code) do update
       set program_name = excluded.program_name,
           opeid = excluded.opeid,
           max_annual_award_cents = excluded.max_annual_award_cents,
           updated_at = now()
     returning id, tenant_id, program_code, program_name, opeid, active,
               max_annual_award_cents, created_at, updated_at`,
    [
      actor.tenantId,
      programCode,
      programName,
      input.opeid ?? null,
      input.maxAnnualAwardCents ?? null,
    ]
  );

  return mapProgram(result.rows[0]);
}

export async function listFederalPrograms(
  actor: AcademyActor,
  db: FederalAidDatabase
): Promise<FederalAidProgram[]> {
  const allowed = actor.roles.some((r) =>
    ["institution_admin", "finance", "registrar"].includes(r)
  );
  if (!allowed) {
    throw new AcademyAuthorizationError(
      "Forbidden federal program read access."
    );
  }

  const result = await db.query(
    `select id, tenant_id, program_code, program_name, opeid, active,
            max_annual_award_cents, created_at, updated_at
       from academy_federal_aid_programs
      where tenant_id = $1
      order by program_code`,
    [actor.tenantId]
  );

  return result.rows.map(mapProgram);
}

export async function createSapEvaluation(
  actor: AcademyActor,
  input: {
    studentPersonId: string;
    evaluationPeriod: string;
    qualitativeStandard: SapStandard;
    quantitativeStandard: SapStandard;
    cumulativeGpa?: number;
    completionRate?: number;
    maxTimeframeCompliant?: boolean;
    notes?: string;
  },
  db: FederalAidDatabase
): Promise<SapEvaluation> {
  assertRegistrarOrAdmin(actor);

  const studentPersonId = requireText(input.studentPersonId, "studentPersonId");
  const evaluationPeriod = requireText(
    input.evaluationPeriod,
    "evaluationPeriod"
  );

  // Check for duplicate evaluation period
  const existing = await db.query(
    `select id
       from academy_sap_evaluations
      where tenant_id = $1
        and student_person_id = $2
        and evaluation_period = $3`,
    [actor.tenantId, studentPersonId, evaluationPeriod]
  );

  if (existing.rows.length > 0) {
    throw new AcademyConflictError(
      `SAP evaluation for period ${evaluationPeriod} already exists.`
    );
  }

  const result = await db.query(
    `insert into academy_sap_evaluations (
       tenant_id,
       student_person_id,
       evaluation_period,
       evaluation_date,
       qualitative_standard,
       quantitative_standard,
       cumulative_gpa,
       completion_rate,
       max_timeframe_compliant,
       evaluated_by_person_id,
       notes
     ) values ($1, $2, $3, current_date, $4, $5, $6, $7, $8, $9, $10)
     returning id, tenant_id, student_person_id, evaluation_period,
               evaluation_date, qualitative_standard, quantitative_standard,
               cumulative_gpa, completion_rate, max_timeframe_compliant,
               evaluated_by_person_id, appeal_filed, appeal_outcome,
               notes, created_at, updated_at`,
    [
      actor.tenantId,
      studentPersonId,
      evaluationPeriod,
      input.qualitativeStandard,
      input.quantitativeStandard,
      input.cumulativeGpa ?? null,
      input.completionRate ?? null,
      input.maxTimeframeCompliant ?? true,
      actor.userId,
      input.notes ?? null,
    ]
  );

  return mapSapEvaluation(result.rows[0]);
}

export async function updateSapAppeal(
  actor: AcademyActor,
  evaluationId: string,
  appealOutcome: AppealOutcome,
  db: FederalAidDatabase
): Promise<SapEvaluation> {
  assertRegistrarOrAdmin(actor);

  const evalId = requireText(evaluationId, "evaluationId");

  const result = await db.query(
    `update academy_sap_evaluations
        set appeal_filed = true,
            appeal_outcome = $3,
            updated_at = now()
      where tenant_id = $1
        and id = $2
     returning id, tenant_id, student_person_id, evaluation_period,
               evaluation_date, qualitative_standard, quantitative_standard,
               cumulative_gpa, completion_rate, max_timeframe_compliant,
               evaluated_by_person_id, appeal_filed, appeal_outcome,
               notes, created_at, updated_at`,
    [actor.tenantId, evalId, appealOutcome]
  );

  if (!result.rows[0]) {
    throw new Error(`SAP evaluation ${evalId} not found.`);
  }

  return mapSapEvaluation(result.rows[0]);
}

export async function getStudentSapHistory(
  actor: AcademyActor,
  studentPersonId: string,
  db: FederalAidDatabase
): Promise<SapEvaluation[]> {
  const subject = requireText(studentPersonId, "studentPersonId");

  // Students can read their own; admin roles can read any
  const isOwnRecord = subject === actor.userId;
  const isAdmin = actor.roles.some((r) =>
    ["institution_admin", "registrar"].includes(r)
  );

  if (!isOwnRecord && !isAdmin) {
    throw new AcademyAuthorizationError(
      "Students can read only their own SAP history."
    );
  }

  const result = await db.query(
    `select id, tenant_id, student_person_id, evaluation_period,
            evaluation_date, qualitative_standard, quantitative_standard,
            cumulative_gpa, completion_rate, max_timeframe_compliant,
            evaluated_by_person_id, appeal_filed, appeal_outcome,
            notes, created_at, updated_at
       from academy_sap_evaluations
      where tenant_id = $1
        and student_person_id = $2
      order by evaluation_date desc`,
    [actor.tenantId, subject]
  );

  return result.rows.map(mapSapEvaluation);
}

export async function recordFederalDisbursement(
  actor: AcademyActor,
  input: {
    reportingPeriod: string;
    programCode: string;
    studentPersonId: string;
    disbursementAmountCents: number;
    disbursementDate: string;
    codReference?: string;
  },
  db: FederalAidDatabase
): Promise<FederalDisbursementReport> {
  assertFinanceOrAdmin(actor);

  const reportingPeriod = requireText(input.reportingPeriod, "reportingPeriod");
  const programCode = requireText(input.programCode, "programCode");
  const studentPersonId = requireText(input.studentPersonId, "studentPersonId");
  const disbursementDate = requireText(
    input.disbursementDate,
    "disbursementDate"
  );

  assertPositiveAmount(input.disbursementAmountCents);

  const result = await db.query(
    `insert into academy_federal_disbursement_reports (
       tenant_id,
       reporting_period,
       program_code,
       student_person_id,
       disbursement_amount_cents,
       disbursement_date,
       cod_reference
     ) values ($1, $2, $3, $4, $5, $6, $7)
     returning id, tenant_id, reporting_period, program_code,
               student_person_id, disbursement_amount_cents,
               disbursement_date, cod_reference, status,
               created_at, updated_at`,
    [
      actor.tenantId,
      reportingPeriod,
      programCode,
      studentPersonId,
      input.disbursementAmountCents,
      disbursementDate,
      input.codReference ?? null,
    ]
  );

  return mapDisbursementReport(result.rows[0]);
}

export async function markDisbursementReported(
  actor: AcademyActor,
  disbursementId: string,
  db: FederalAidDatabase
): Promise<FederalDisbursementReport> {
  assertFinanceOrAdmin(actor);

  const disbId = requireText(disbursementId, "disbursementId");

  const result = await db.query(
    `update academy_federal_disbursement_reports
        set status = 'reported',
            updated_at = now()
      where tenant_id = $1
        and id = $2
     returning id, tenant_id, reporting_period, program_code,
               student_person_id, disbursement_amount_cents,
               disbursement_date, cod_reference, status,
               created_at, updated_at`,
    [actor.tenantId, disbId]
  );

  if (!result.rows[0]) {
    throw new Error(`Disbursement report ${disbId} not found.`);
  }

  return mapDisbursementReport(result.rows[0]);
}

export async function getFederalDisbursementReport(
  actor: AcademyActor,
  reportingPeriod: string,
  db: FederalAidDatabase
): Promise<FederalDisbursementReport[]> {
  assertFinanceOrAdmin(actor);

  const period = requireText(reportingPeriod, "reportingPeriod");

  const result = await db.query(
    `select id, tenant_id, reporting_period, program_code,
            student_person_id, disbursement_amount_cents,
            disbursement_date, cod_reference, status,
            created_at, updated_at
       from academy_federal_disbursement_reports
      where tenant_id = $1
        and reporting_period = $2
      order by disbursement_date, student_person_id`,
    [actor.tenantId, period]
  );

  return result.rows.map(mapDisbursementReport);
}
