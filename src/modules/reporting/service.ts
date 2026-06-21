import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type {
  ReportDataset,
  ReportDefinition,
  ReportId,
  ReportRepository,
  ReportRow,
  ReportingDashboard,
} from "@/modules/reporting/types";

const reportingRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
]);

export const reportDefinitions: ReportDefinition[] = [
  {
    id: "enrollment",
    label: "Enrollment",
    description: "Student enrollment, program, term, and credit position.",
    columns: [
      { key: "studentNumber", label: "Student Number" },
      { key: "studentName", label: "Student Name" },
      { key: "program", label: "Program" },
      { key: "status", label: "Status" },
      { key: "activeTerm", label: "Active Term" },
      { key: "creditsEarned", label: "Credits Earned" },
    ],
  },
  {
    id: "admissions",
    label: "Admissions",
    description: "Admissions application status and decision timing.",
    columns: [
      { key: "applicationId", label: "Application ID" },
      { key: "applicantName", label: "Applicant Name" },
      { key: "status", label: "Status" },
      { key: "program", label: "Program" },
      { key: "submittedAt", label: "Submitted At" },
      { key: "decidedAt", label: "Decided At" },
    ],
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Attendance rates by student and section.",
    columns: [
      { key: "sectionCode", label: "Section Code" },
      { key: "sectionTitle", label: "Section Title" },
      { key: "studentName", label: "Student Name" },
      { key: "presentCount", label: "Present Count" },
      { key: "absentCount", label: "Absent Count" },
      { key: "attendanceRate", label: "Attendance Rate" },
    ],
  },
  {
    id: "grades",
    label: "Grades",
    description: "Posted and submitted grade summary by section and student.",
    columns: [
      { key: "sectionCode", label: "Section Code" },
      { key: "sectionTitle", label: "Section Title" },
      { key: "studentName", label: "Student Name" },
      { key: "finalScore", label: "Final Score" },
      { key: "postedStatus", label: "Posted Status" },
    ],
  },
  {
    id: "transcripts",
    label: "Transcripts",
    description: "Transcript requests, issuance, delivery, and hold status.",
    columns: [
      { key: "studentName", label: "Student Name" },
      { key: "requestStatus", label: "Request Status" },
      { key: "deliveryMethod", label: "Delivery Method" },
      { key: "issuedAt", label: "Issued At" },
      { key: "holdStatus", label: "Hold Status" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    description: "Student account ledger export.",
    columns: [
      { key: "studentName", label: "Student Name" },
      { key: "entryType", label: "Entry Type" },
      { key: "amount", label: "Amount" },
      { key: "description", label: "Description" },
      { key: "postedAt", label: "Posted At" },
    ],
  },
  {
    id: "aid",
    label: "Financial Aid",
    description: "Institutional aid awards and posted disbursements.",
    columns: [
      { key: "studentName", label: "Student Name" },
      { key: "aidYear", label: "Aid Year" },
      { key: "awardStatus", label: "Award Status" },
      { key: "acceptedAmount", label: "Accepted Amount" },
      { key: "postedAmount", label: "Posted Amount" },
    ],
  },
  {
    id: "retention",
    label: "Retention",
    description: "Student continuation and risk flags.",
    columns: [
      { key: "studentName", label: "Student Name" },
      { key: "status", label: "Status" },
      { key: "activeTerm", label: "Active Term" },
      { key: "riskFlag", label: "Risk Flag" },
    ],
  },
  {
    id: "program_completion",
    label: "Program Completion",
    description: "Program progress and completion percentage.",
    columns: [
      { key: "studentName", label: "Student Name" },
      { key: "program", label: "Program" },
      { key: "creditsEarned", label: "Credits Earned" },
      { key: "requiredCredits", label: "Required Credits" },
      { key: "completionPercent", label: "Completion Percent" },
    ],
  },
];

const definitionsById = new Map(reportDefinitions.map((definition) => [definition.id, definition]));

export function parseReportId(value: string | null | undefined): ReportId {
  if (value && definitionsById.has(value as ReportId)) {
    return value as ReportId;
  }
  throw new Error("Invalid report type.");
}

export function assertReportingAccess(actor: AcademyActor) {
  if (!actor.roles.some((role) => reportingRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden reporting access.");
  }
}

export function buildReportingDashboard(dataset: ReportDataset): ReportingDashboard {
  const reports = Object.fromEntries(
    reportDefinitions.map((definition) => [
      definition.id,
      {
        definition,
        rows: dataset.reports[definition.id] ?? [],
      },
    ]),
  ) as ReportingDashboard["reports"];

  return {
    tenantId: dataset.tenantId,
    generatedAt: dataset.generatedAt,
    cards: [
      {
        label: "Enrollment rows",
        value: reports.enrollment.rows.length,
        detail: "Student status export",
      },
      {
        label: "Admissions rows",
        value: reports.admissions.rows.length,
        detail: "Application pipeline export",
      },
      {
        label: "Finance rows",
        value: reports.billing.rows.length + reports.aid.rows.length,
        detail: "Billing plus aid rows",
      },
      {
        label: "Completion rows",
        value: reports.program_completion.rows.length,
        detail: "Program progress export",
      },
    ],
    reports,
  };
}

function csvValue(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

export function exportReportCsv(reportId: ReportId, dataset: ReportDataset) {
  const definition = definitionsById.get(reportId);
  if (!definition) throw new Error("Invalid report type.");

  const rows = dataset.reports[reportId] ?? [];
  const header = definition.columns.map((column) => csvValue(column.label)).join(",");
  const body = rows.map((row) =>
    definition.columns.map((column) => csvValue((row as ReportRow)[column.key])).join(","),
  );
  return `${[header, ...body].join("\r\n")}\r\n`;
}

export class ReportingService {
  constructor(private readonly repository: ReportRepository) {}

  async readDashboard(actor: AcademyActor) {
    assertReportingAccess(actor);
    return buildReportingDashboard(await this.repository.readDataset(actor.tenantId));
  }

  async exportCsv(actor: AcademyActor, reportId: ReportId) {
    assertReportingAccess(actor);
    return exportReportCsv(reportId, await this.repository.readDataset(actor.tenantId));
  }
}
