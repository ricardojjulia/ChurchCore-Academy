import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  markDisbursementReported,
  type FederalAidDatabase,
} from "@/modules/financial-aid/federal-aid";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: disbursementId } = await params;

    return withAcademyDatabaseContext(actor, (client) =>
      markDisbursementReported(actor, disbursementId, asAcademyDatabase<FederalAidDatabase>(client)),
    );
  });
}
