import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    if (!actor.roles.includes("guardian")) {
      throw new AcademyAuthorizationError("Guardian role required.");
    }
    const { studentId } = await context.params;
    const body = await request.json().catch(() => ({})) as { absenceAlertsEnabled?: boolean };

    return withAcademyDatabaseContext(actor, async (client) => {
      const relationship = await client.query(
        `select id
           from academy_student_relationships
          where tenant_id = $1
            and related_person_id = $2
            and student_person_id = $3
            and status = 'active'
          limit 1`,
        [actor.tenantId, actor.userId, studentId],
      ) as { rows: { id: string }[] };
      if (!relationship.rows[0]) {
        throw new AcademyAuthorizationError("Guardian is not linked to this student.");
      }
      return {
        studentPersonId: studentId,
        absenceAlertsEnabled: body.absenceAlertsEnabled !== false,
      };
    });
  });
}
