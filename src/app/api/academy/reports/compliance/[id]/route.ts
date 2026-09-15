import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  getComplianceReport,
  type ComplianceDatabase,
} from "@/modules/reporting/compliance-reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    return withAcademyDatabaseContext(actor, (client) =>
      getComplianceReport(actor, id, asAcademyDatabase<ComplianceDatabase>(client)),
    );
  });
}
