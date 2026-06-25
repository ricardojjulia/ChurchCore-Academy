import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";

export type ComplianceReportType =
  | "ipeds_annual"
  | "ats_annual"
  | "title_iv_enrollment"
  | "gainful_employment"
  | "state_authorization"
  | "custom";

export type ComplianceReportStatus =
  | "draft"
  | "review"
  | "submitted"
  | "accepted"
  | "rejected";

export interface ComplianceReport {
  id: string;
  tenantId: string;
  reportType: ComplianceReportType;
  reportingYear: string;
  status: ComplianceReportStatus;
  generatedByPersonId: string;
  submittedAt: string | null;
  submissionReference: string | null;
  dataSnapshot: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateComplianceReportInput {
  reportType: ComplianceReportType;
  reportingYear: string;
  notes?: string;
}

export interface ComplianceDatabase {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
}

const ADMIN_ROLES = new Set(["institution_admin", "academic_admin", "registrar"]);

function assertAdmin(actor: AcademyActor): void {
  if (!actor.roles.some((r) => ADMIN_ROLES.has(r))) {
    throw new AcademyAuthorizationError(
      "Institution admin or registrar role required for compliance reports.",
    );
  }
}

function rowToReport(row: Record<string, unknown>): ComplianceReport {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    reportType: row.report_type as ComplianceReportType,
    reportingYear: String(row.reporting_year),
    status: row.status as ComplianceReportStatus,
    generatedByPersonId: String(row.generated_by_person_id),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    submissionReference: row.submission_reference ? String(row.submission_reference) : null,
    dataSnapshot: row.data_snapshot
      ? (typeof row.data_snapshot === "string"
          ? (JSON.parse(row.data_snapshot) as Record<string, unknown>)
          : (row.data_snapshot as Record<string, unknown>))
      : {},
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function collectReportData(
  actor: AcademyActor,
  reportType: ComplianceReportType,
  reportingYear: string,
  db: ComplianceDatabase,
): Promise<Record<string, unknown>> {
  const yearParts = reportingYear.split("-");
  const startYear = yearParts[0] ?? reportingYear;

  const [enrollmentResult, staffResult, programResult] = await Promise.all([
    db.query(
      `select count(*) as total_students,
              sum(case when gender = 'male' then 1 else 0 end) as male_count,
              sum(case when gender = 'female' then 1 else 0 end) as female_count
       from academy_students
       where tenant_id = $1 and status = 'active'`,
      [actor.tenantId],
    ),
    db.query(
      `select count(*) as total_staff
       from academy_staff_members
       where tenant_id = $1 and status = 'active'`,
      [actor.tenantId],
    ),
    db.query(
      `select count(*) as total_programs
       from academy_programs
       where tenant_id = $1 and active = true`,
      [actor.tenantId],
    ),
  ]);

  const snapshot: Record<string, unknown> = {
    reportType,
    reportingYear,
    collectedAt: new Date().toISOString(),
    enrollment: enrollmentResult.rows[0] ?? {},
    staffing: staffResult.rows[0] ?? {},
    programs: programResult.rows[0] ?? {},
  };

  if (reportType === "ats_annual" || reportType === "ipeds_annual") {
    const degreeResult = await db.query(
      `select program_type, count(*) as count
       from academy_programs
       where tenant_id = $1 and active = true
       group by program_type`,
      [actor.tenantId],
    );
    snapshot.programsByType = degreeResult.rows;
  }

  if (reportType === "title_iv_enrollment") {
    const aidResult = await db.query(
      `select count(*) as total_aid_recipients
       from academy_federal_programs
       where tenant_id = $1`,
      [actor.tenantId],
    );
    snapshot.financialAid = aidResult.rows[0] ?? {};
    void startYear;
  }

  return snapshot;
}

export async function generateComplianceReport(
  actor: AcademyActor,
  input: GenerateComplianceReportInput,
  db: ComplianceDatabase,
): Promise<ComplianceReport> {
  assertAdmin(actor);

  if (!input.reportingYear.match(/^\d{4}(-\d{4})?$/)) {
    throw new Error("reportingYear must be in format YYYY or YYYY-YYYY.");
  }

  const dataSnapshot = await collectReportData(actor, input.reportType, input.reportingYear, db);

  const result = await db.query(
    `insert into academy_compliance_reports
       (tenant_id, report_type, reporting_year, status, generated_by_person_id, data_snapshot, notes)
     values ($1, $2, $3, 'draft', $4, $5, $6)
     returning *`,
    [
      actor.tenantId,
      input.reportType,
      input.reportingYear,
      actor.userId,
      JSON.stringify(dataSnapshot),
      input.notes ?? null,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Failed to create compliance report.");
  return rowToReport(row);
}

export async function listComplianceReports(
  actor: AcademyActor,
  db: ComplianceDatabase,
): Promise<ComplianceReport[]> {
  assertAdmin(actor);

  const result = await db.query(
    `select * from academy_compliance_reports
     where tenant_id = $1
     order by created_at desc`,
    [actor.tenantId],
  );

  return result.rows.map(rowToReport);
}

export async function getComplianceReport(
  actor: AcademyActor,
  reportId: string,
  db: ComplianceDatabase,
): Promise<ComplianceReport> {
  assertAdmin(actor);

  const result = await db.query(
    `select * from academy_compliance_reports
     where tenant_id = $1 and id = $2`,
    [actor.tenantId, reportId],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Compliance report not found or access denied.");
  return rowToReport(row);
}

export async function advanceComplianceReportStatus(
  actor: AcademyActor,
  reportId: string,
  newStatus: Extract<ComplianceReportStatus, "review" | "submitted">,
  db: ComplianceDatabase,
  submissionReference?: string,
): Promise<ComplianceReport> {
  assertAdmin(actor);

  let sql: string;
  let updateParams: unknown[];

  if (newStatus === "submitted") {
    sql = `update academy_compliance_reports
           set status = $1,
               submitted_at = now(),
               submission_reference = $4,
               updated_at = now()
           where tenant_id = $2 and id = $3
           returning *`;
    updateParams = [newStatus, actor.tenantId, reportId, submissionReference ?? null];
  } else {
    sql = `update academy_compliance_reports
           set status = $1,
               updated_at = now()
           where tenant_id = $2 and id = $3
           returning *`;
    updateParams = [newStatus, actor.tenantId, reportId];
  }

  const result = await db.query(sql, updateParams);
  const row = result.rows[0];
  if (!row) throw new Error("Compliance report not found or access denied.");
  return rowToReport(row);
}
