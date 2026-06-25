import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { recordStudentAidDecision, LetterDatabaseClient } from "@/modules/financial-aid/aid-letter-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: packageId } = await context.params;
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      recordStudentAidDecision(
        actor,
        {
          packageId,
          decision: body.decision as "accepted" | "declined",
        },
        asAcademyDatabase<LetterDatabaseClient>(client),
      ),
    );
  });
}
