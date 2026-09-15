import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { fileConductRecord, type FileConductRecordInput, type ConductDatabase } from "@/modules/people/conduct";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as FileConductRecordInput;

    return withAcademyDatabaseContext(actor, (client) =>
      fileConductRecord(actor, body, asAcademyDatabase<ConductDatabase>(client)),
    );
  });
}
