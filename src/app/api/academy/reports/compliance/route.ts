import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  generateComplianceReport,
  listComplianceReports,
  type ComplianceDatabase,
  type ComplianceReportType,
} from "@/modules/reporting/compliance-reports";

const VALID_REPORT_TYPES: ComplianceReportType[] = [
  "ipeds_annual", "ats_annual", "title_iv_enrollment",
  "gainful_employment", "state_authorization", "custom",
];

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      listComplianceReports(actor, asAcademyDatabase<ComplianceDatabase>(client)),
    );
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    const reportType = String(body.reportType ?? "").trim();
    const reportingYear = String(body.reportingYear ?? "").trim();
    const notes = body.notes ? String(body.notes).trim() : undefined;

    if (!reportType) throw new Error("reportType is required.");
    if (!VALID_REPORT_TYPES.includes(reportType as ComplianceReportType)) {
      throw new Error(`reportType must be one of: ${VALID_REPORT_TYPES.join(", ")}.`);
    }
    if (!reportingYear) throw new Error("reportingYear is required.");

    return withAcademyDatabaseContext(actor, (client) =>
      generateComplianceReport(
        actor,
        { reportType: reportType as ComplianceReportType, reportingYear, notes },
        asAcademyDatabase<ComplianceDatabase>(client),
      ),
    );
  });
}
