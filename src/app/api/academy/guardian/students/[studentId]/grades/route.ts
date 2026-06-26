import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { fetchGuardianStudentSummary } from "@/modules/people/guardian-access";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    if (!actor.roles.includes("guardian")) {
      throw new AcademyAuthorizationError("Guardian role required.");
    }
    const { studentId } = await context.params;
    const summary = await withAcademyDatabaseContext(actor, (client) =>
      fetchGuardianStudentSummary(actor.userId, studentId, actor.tenantId, client),
    );
    if (summary === null || summary.grades === null) {
      return { ferpaRestricted: summary === null, grades: null };
    }
    return { grades: summary.grades };
  });
}
