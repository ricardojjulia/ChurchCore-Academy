import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updateSapAppeal,
  type FederalAidDatabase,
  type AppealOutcome,
} from "@/modules/financial-aid/federal-aid";

function appealOutcome(value: unknown): AppealOutcome {
  if (value === "approved" || value === "denied") {
    return value;
  }
  throw new Error("appealOutcome must be approved or denied.");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; evalId: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { evalId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    return withAcademyDatabaseContext(actor, (client) =>
      updateSapAppeal(
        actor,
        evalId,
        appealOutcome(body.appealOutcome),
        asAcademyDatabase<FederalAidDatabase>(client),
      ),
    );
  });
}
