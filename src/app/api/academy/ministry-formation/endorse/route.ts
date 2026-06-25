import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { endorseRecord } from "@/modules/ministry-formation/service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      endorseRecord(actor, {
        recordType: body.recordType as "practicum" | "milestone" | "evaluation",
        recordId: String(body.recordId),
      }, client),
    );
  });
}
