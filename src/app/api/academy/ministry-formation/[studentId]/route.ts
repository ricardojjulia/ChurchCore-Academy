import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { getStudentFormationRecord } from "@/modules/ministry-formation/service";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { studentId } = await context.params;
    return withAcademyDatabaseContext(actor, (client) =>
      getStudentFormationRecord(actor, studentId, client),
    );
  });
}
