import { handleApi, requireBooleanField } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    if (!actor.roles.includes("guardian")) {
      throw new AcademyAuthorizationError("Guardian role required.");
    }
    const { studentId } = await context.params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const absenceAlertsEnabled = requireBooleanField(
      body.absenceAlertsEnabled,
      "absenceAlertsEnabled",
    );

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "guardianPortal");
      const relationship = await client.query(
        `update academy_student_relationships
            set absence_alerts_enabled = $4,
                updated_at = now()
          where tenant_id = $1
            and related_person_id = $2
            and student_person_id = $3
            and relationship_type in ('parent', 'guardian')
            and status = 'active'
          returning id, absence_alerts_enabled`,
        [actor.tenantId, actor.userId, studentId, absenceAlertsEnabled],
      ) as { rows: { id: string; absence_alerts_enabled: boolean }[] };
      if (!relationship.rows[0]) {
        throw new AcademyAuthorizationError("Guardian is not linked to this student.");
      }
      return {
        studentPersonId: studentId,
        absenceAlertsEnabled: relationship.rows[0].absence_alerts_enabled,
      };
    });
  });
}
