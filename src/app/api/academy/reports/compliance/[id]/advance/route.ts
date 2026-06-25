import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  advanceComplianceReportStatus,
  type ComplianceDatabase,
} from "@/modules/reporting/compliance-reports";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const newStatus = String(body.status ?? "").trim();
    if (newStatus !== "review" && newStatus !== "submitted") {
      throw new Error("status must be review or submitted.");
    }

    const submissionReference = body.submissionReference
      ? String(body.submissionReference).trim()
      : undefined;

    return withAcademyDatabaseContext(actor, (client) =>
      advanceComplianceReportStatus(
        actor,
        id,
        newStatus as "review" | "submitted",
        asAcademyDatabase<ComplianceDatabase>(client),
        submissionReference,
      ),
    );
  });
}
