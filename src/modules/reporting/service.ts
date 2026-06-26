import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type {
  ReportDataset,
  ReportDefinition,
  ReportId,
  ReportRepository,
  ReportRow,
  ReportingDashboard,
  ScheduledReport,
} from "@/modules/reporting/types";

const reportingRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
  "finance",
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

export const IPEDS_REVIEW_DISCLAIMER =
  "Review this export with your IPEDS data preparer before submission. ChurchCore Academy does not certify IPEDS compliance.";

export interface IpedsInstitutionInput {
  name: string;
  address: string;
  primaryMode: string;
  ipedsUnitid?: string | null;
  fullTimeCreditHoursThreshold?: number | null;
}

export interface IpedsEnrollmentInput {
  studentPersonId: string;
  level: "undergraduate" | "graduate" | "certificate";
  enrolledCredits: number;
  raceEthnicity?: string | null;
}

export interface IpedsExportInput {
  institution: IpedsInstitutionInput;
  enrollmentRows: IpedsEnrollmentInput[];
  facultyCount: number;
}

export interface IpedsExport {
  label: "IPEDS-formatted (review required)";
  disclaimer: string;
  warnings: string[];
  ic: {
    institutionName: string;
    address: string;
    unitid: string | null;
    sectorCode: string;
    totalEnrollment: number;
    studentFacultyRatio: string;
  };
  ef: {
    byLevel: Record<IpedsEnrollmentInput["level"], number>;
    byAttendanceStatus: { fullTime: number; partTime: number };
    byRaceEthnicity: Record<string, number>;
  };
}

export interface ScheduledReportStorage {
  upload(path: string, body: string, contentType: string): Promise<string>;
  signedUrl(path: string, expiresInSeconds: number): Promise<string>;
}

export interface ScheduledReportNotification {
  recipients: string[];
  subject: string;
  body: string;
}

export interface ReportingServiceDependencies {
  storage?: ScheduledReportStorage;
  notify?: (message: ScheduledReportNotification) => Promise<void>;
  now?: () => Date;
}

export function parseReportId(value: string | null | undefined): ReportId {
  if (value && definitionsById.has(value as ReportId)) {
    return value as ReportId;
  }
  throw new Error("Invalid report type.");
}

function sectorCodeForMode(mode: string) {
  switch (mode) {
    case "seminary":
    case "college":
    case "university":
      return "postsecondary";
    case "bible_school":
      return "certificate_or_non_degree";
    case "k12":
    case "childrens_school":
      return "not_applicable_k12";
    default:
      return "review_required";
  }
}

function emptyLevelCounts(): Record<IpedsEnrollmentInput["level"], number> {
  return { undergraduate: 0, graduate: 0, certificate: 0 };
}

export function generateIpedsExport(input: IpedsExportInput): IpedsExport {
  const threshold = input.institution.fullTimeCreditHoursThreshold ?? 12;
  const warnings: string[] = [];

  if (!input.institution.ipedsUnitid) {
    warnings.push("unitid_not_configured");
  }
  if (!input.institution.fullTimeCreditHoursThreshold) {
    warnings.push("full_time_credit_hours_threshold_defaulted");
  }

  const byLevel = emptyLevelCounts();
  const byAttendanceStatus = { fullTime: 0, partTime: 0 };
  const byRaceEthnicity: Record<string, number> = {};

  for (const row of input.enrollmentRows) {
    byLevel[row.level] += 1;
    if (row.enrolledCredits >= threshold) {
      byAttendanceStatus.fullTime += 1;
    } else {
      byAttendanceStatus.partTime += 1;
    }
    if (row.raceEthnicity) {
      byRaceEthnicity[row.raceEthnicity] = (byRaceEthnicity[row.raceEthnicity] ?? 0) + 1;
    }
  }

  const totalEnrollment = input.enrollmentRows.length;
  const ratio = input.facultyCount > 0
    ? `${Math.round(totalEnrollment / input.facultyCount)}:1`
    : "faculty_count_not_configured";

  return {
    label: "IPEDS-formatted (review required)",
    disclaimer: IPEDS_REVIEW_DISCLAIMER,
    warnings,
    ic: {
      institutionName: input.institution.name,
      address: input.institution.address,
      unitid: input.institution.ipedsUnitid ?? null,
      sectorCode: sectorCodeForMode(input.institution.primaryMode),
      totalEnrollment,
      studentFacultyRatio: ratio,
    },
    ef: {
      byLevel,
      byAttendanceStatus,
      byRaceEthnicity,
    },
  };
}

export function exportIpedsCsv(exportData: IpedsExport) {
  const lines = [
    [exportData.label],
    [IPEDS_REVIEW_DISCLAIMER],
    ["warnings", exportData.warnings.join("|")],
    ["component", "field", "value"],
    ["IC", "institution_name", exportData.ic.institutionName],
    ["IC", "address", exportData.ic.address],
    ["IC", "unitid", exportData.ic.unitid ?? ""],
    ["IC", "sector_code", exportData.ic.sectorCode],
    ["IC", "total_enrollment", exportData.ic.totalEnrollment],
    ["IC", "student_faculty_ratio", exportData.ic.studentFacultyRatio],
    ["EF", "undergraduate", exportData.ef.byLevel.undergraduate],
    ["EF", "graduate", exportData.ef.byLevel.graduate],
    ["EF", "certificate", exportData.ef.byLevel.certificate],
    ["EF", "full_time", exportData.ef.byAttendanceStatus.fullTime],
    ["EF", "part_time", exportData.ef.byAttendanceStatus.partTime],
  ];

  return `${lines.map((line) => line.map(csvValue).join(",")).join("\r\n")}\r\n`;
}

export function generateIpedsExportFromDataset(dataset: ReportDataset): IpedsExport {
  const enrollmentRows = (dataset.reports.enrollment ?? []).map((row, index) => {
    const program = String(row.program ?? "").toLowerCase();
    const level: IpedsEnrollmentInput["level"] = program.includes("graduate") ||
      program.includes("seminary") ||
      program.includes("master")
      ? "graduate"
      : program.includes("certificate")
        ? "certificate"
        : "undergraduate";

    return {
      studentPersonId: String(row.studentNumber ?? row.studentName ?? `student-${index + 1}`),
      level,
      enrolledCredits: Number(row.creditsEarned ?? 0),
    };
  });

  return generateIpedsExport({
    institution: {
      name: dataset.tenantId,
      address: "Institution address not configured",
      primaryMode: "review_required",
      ipedsUnitid: null,
      fullTimeCreditHoursThreshold: 12,
    },
    enrollmentRows,
    facultyCount: 0,
  });
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
  constructor(
    private readonly repository: ReportRepository,
    private readonly dependencies: ReportingServiceDependencies = {},
  ) {}

  async readDashboard(actor: AcademyActor) {
    assertReportingAccess(actor);
    return buildReportingDashboard(await this.repository.readDataset(actor.tenantId));
  }

  async exportCsv(actor: AcademyActor, reportId: ReportId) {
    assertReportingAccess(actor);
    return exportReportCsv(reportId, await this.repository.readDataset(actor.tenantId));
  }

  async exportIpedsCsv(actor: AcademyActor) {
    assertReportingAccess(actor);
    return exportIpedsCsv(generateIpedsExportFromDataset(
      await this.repository.readDataset(actor.tenantId),
    ));
  }

  async runScheduledReports(actor: AcademyActor, schedules: ScheduledReport[]) {
    assertReportingAccess(actor);
    if (!this.dependencies.storage || !this.dependencies.notify) {
      throw new Error("Scheduled report delivery is not configured.");
    }

    const now = this.dependencies.now?.() ?? new Date();
    const due = schedules.filter(
      (schedule) =>
        schedule.tenantId === actor.tenantId &&
        schedule.active &&
        new Date(schedule.nextRunAt).getTime() <= now.getTime(),
    );

    const delivered: string[] = [];
    for (const schedule of due) {
      const reportId = scheduledReportToReportId(schedule.reportType);
      const body = schedule.format === "json"
        ? JSON.stringify(await this.repository.readDataset(actor.tenantId))
        : await this.exportCsv(actor, reportId);
      const date = now.toISOString().slice(0, 10);
      const path = `${actor.tenantId}/scheduled/${schedule.reportType}/${date}/${schedule.id}.${schedule.format}`;
      const storedPath = await this.dependencies.storage.upload(
        path,
        body,
        schedule.format === "json" ? "application/json" : "text/csv",
      );
      const signedUrl = await this.dependencies.storage.signedUrl(storedPath, 86400);
      await this.dependencies.notify({
        recipients: schedule.recipients,
        subject: "Scheduled Academy report is ready",
        body: `Your scheduled ${schedule.reportType.replaceAll("_", " ")} report is ready: ${signedUrl}`,
      });
      delivered.push(schedule.id);
    }

    return { delivered };
  }
}

function scheduledReportToReportId(reportType: ScheduledReport["reportType"]): ReportId {
  switch (reportType) {
    case "enrollment_summary":
      return "enrollment";
    case "attendance_summary":
      return "attendance";
    case "grade_summary":
      return "grades";
    case "financial_summary":
      return "billing";
    case "ipeds_export":
      return "enrollment";
    default:
      return "enrollment";
  }
}
