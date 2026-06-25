import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { ComplianceDatabase, ComplianceReport } from "@/modules/reporting/compliance-reports";
import {
  generateComplianceReport,
  listComplianceReports,
  getComplianceReport,
  advanceComplianceReportStatus,
} from "@/modules/reporting/compliance-reports";

const adminActor: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const studentActor: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const crossTenantActor: AcademyActor = {
  userId: "person-other",
  tenantId: "tenant-2",
  roles: ["institution_admin"],
};

function reportToRow(r: ComplianceReport): Record<string, unknown> {
  return {
    id: r.id,
    tenant_id: r.tenantId,
    report_type: r.reportType,
    reporting_year: r.reportingYear,
    status: r.status,
    generated_by_person_id: r.generatedByPersonId,
    submitted_at: r.submittedAt,
    submission_reference: r.submissionReference,
    data_snapshot: JSON.stringify(r.dataSnapshot),
    notes: r.notes,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function mockReport(overrides: Partial<ComplianceReport> = {}): ComplianceReport {
  return {
    id: "report-1",
    tenantId: "tenant-1",
    reportType: "ipeds_annual",
    reportingYear: "2025-2026",
    status: "draft",
    generatedByPersonId: "person-admin",
    submittedAt: null,
    submissionReference: null,
    dataSnapshot: { reportType: "ipeds_annual", reportingYear: "2025-2026" },
    notes: null,
    createdAt: "2026-06-24T08:00:00Z",
    updatedAt: "2026-06-24T08:00:00Z",
    ...overrides,
  };
}

function createMockDb(reports: ComplianceReport[] = []): ComplianceDatabase {
  const stored = [...reports];

  return {
    query: async (sql: string, values?: unknown[]) => {
      const sqlLower = sql.toLowerCase();

      // Enrollment count query
      if (sqlLower.includes("from academy_students")) {
        return { rowCount: 1, rows: [{ total_students: 50, male_count: 25, female_count: 25 }] };
      }
      if (sqlLower.includes("from academy_staff_members")) {
        return { rowCount: 1, rows: [{ total_staff: 10 }] };
      }
      if (sqlLower.includes("from academy_programs") && sqlLower.includes("count(*) as total_programs")) {
        return { rowCount: 1, rows: [{ total_programs: 5 }] };
      }
      if (sqlLower.includes("from academy_programs") && sqlLower.includes("group by program_type")) {
        return { rowCount: 2, rows: [{ program_type: "masters", count: 3 }, { program_type: "bachelors", count: 2 }] };
      }
      if (sqlLower.includes("from academy_federal_programs")) {
        return { rowCount: 1, rows: [{ total_aid_recipients: 20 }] };
      }

      if (sqlLower.includes("insert into academy_compliance_reports")) {
        const newReport = mockReport({
          id: `report-${stored.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          reportType: values?.[1] as ComplianceReport["reportType"],
          reportingYear: String(values?.[2] ?? "2025-2026"),
          generatedByPersonId: String(values?.[3] ?? "person-admin"),
          dataSnapshot: JSON.parse(String(values?.[4] ?? "{}")),
          notes: values?.[5] ? String(values[5]) : null,
        });
        stored.push(newReport);
        return { rowCount: 1, rows: [reportToRow(newReport)] };
      }

      if (sqlLower.includes("select * from academy_compliance_reports") && sqlLower.includes("order by")) {
        const tenantId = values?.[0];
        return { rowCount: null, rows: stored.filter(r => r.tenantId === tenantId).map(reportToRow) };
      }

      if (sqlLower.includes("select * from academy_compliance_reports") && !sqlLower.includes("order by")) {
        const tenantId = values?.[0];
        const reportId = values?.[1];
        const found = stored.find(r => r.tenantId === tenantId && r.id === reportId);
        return { rowCount: found ? 1 : 0, rows: found ? [reportToRow(found)] : [] };
      }

      if (sqlLower.includes("update academy_compliance_reports")) {
        const newStatus = String(values?.[0]);
        const tenantId = values?.[1];
        const reportId = values?.[2];
        const idx = stored.findIndex(r => r.tenantId === tenantId && r.id === reportId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        const updated: ComplianceReport = {
          ...stored[idx]!,
          status: newStatus as ComplianceReport["status"],
          submittedAt: newStatus === "submitted" ? new Date().toISOString() : stored[idx]!.submittedAt,
          submissionReference: newStatus === "submitted" && values?.[3]
            ? String(values[3])
            : stored[idx]!.submissionReference,
          updatedAt: new Date().toISOString(),
        };
        stored[idx] = updated;
        return { rowCount: 1, rows: [reportToRow(updated)] };
      }

      return { rowCount: 0, rows: [] };
    },
  };
}

test("generateComplianceReport — success for admin", async () => {
  const db = createMockDb();

  const report = await generateComplianceReport(
    adminActor,
    { reportType: "ipeds_annual", reportingYear: "2025-2026" },
    db,
  );

  assert.equal(report.tenantId, "tenant-1");
  assert.equal(report.reportType, "ipeds_annual");
  assert.equal(report.reportingYear, "2025-2026");
  assert.equal(report.status, "draft");
  assert.equal(report.generatedByPersonId, "person-admin");
  assert.ok(report.dataSnapshot.enrollment);
});

test("generateComplianceReport — rejects student", async () => {
  const db = createMockDb();

  await assert.rejects(
    () => generateComplianceReport(studentActor, { reportType: "ipeds_annual", reportingYear: "2025-2026" }, db),
    { name: "AcademyAuthorizationError" },
  );
});

test("generateComplianceReport — rejects invalid reportingYear format", async () => {
  const db = createMockDb();

  await assert.rejects(
    () => generateComplianceReport(adminActor, { reportType: "ipeds_annual", reportingYear: "25-26" }, db),
    /reportingYear must be in format/,
  );
});

test("listComplianceReports — returns tenant reports", async () => {
  const existing = [
    mockReport({ id: "r-1", reportType: "ipeds_annual", reportingYear: "2024-2025" }),
    mockReport({ id: "r-2", reportType: "ats_annual", reportingYear: "2024-2025" }),
  ];
  const db = createMockDb(existing);

  const reports = await listComplianceReports(adminActor, db);
  assert.equal(reports.length, 2);
});

test("listComplianceReports — cross-tenant returns empty", async () => {
  const existing = [mockReport()];
  const db = createMockDb(existing);

  const reports = await listComplianceReports(crossTenantActor, db);
  assert.equal(reports.length, 0);
});

test("listComplianceReports — rejects student", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => listComplianceReports(studentActor, db),
    { name: "AcademyAuthorizationError" },
  );
});

test("getComplianceReport — returns report by id", async () => {
  const existing = [mockReport()];
  const db = createMockDb(existing);

  const report = await getComplianceReport(adminActor, "report-1", db);
  assert.equal(report.id, "report-1");
  assert.equal(report.reportType, "ipeds_annual");
});

test("getComplianceReport — throws for unknown report", async () => {
  const db = createMockDb([]);
  await assert.rejects(
    () => getComplianceReport(adminActor, "nonexistent", db),
    /not found or access denied/,
  );
});

test("advanceComplianceReportStatus — draft to review", async () => {
  const existing = [mockReport({ id: "report-1", status: "draft" })];
  const db = createMockDb(existing);

  const updated = await advanceComplianceReportStatus(adminActor, "report-1", "review", db);
  assert.equal(updated.status, "review");
});

test("advanceComplianceReportStatus — draft to submitted with reference", async () => {
  const existing = [mockReport({ id: "report-1", status: "review" })];
  const db = createMockDb(existing);

  const updated = await advanceComplianceReportStatus(adminActor, "report-1", "submitted", db, "IPEDS-REF-2025-001");
  assert.equal(updated.status, "submitted");
  assert.ok(updated.submittedAt);
  assert.equal(updated.submissionReference, "IPEDS-REF-2025-001");
});

test("advanceComplianceReportStatus — throws for unknown report", async () => {
  const db = createMockDb([]);
  await assert.rejects(
    () => advanceComplianceReportStatus(adminActor, "nonexistent", "review", db),
    /not found or access denied/,
  );
});

test("advanceComplianceReportStatus — rejects student", async () => {
  const db = createMockDb([mockReport()]);
  await assert.rejects(
    () => advanceComplianceReportStatus(studentActor, "report-1", "review", db),
    { name: "AcademyAuthorizationError" },
  );
});
