import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertInstitutionConfigAccess, AcademyRole } from "@/modules/academy-auth/policy";

const ASSIGNABLE_ROLES: ReadonlySet<AcademyRole> = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "student",
  "guardian",
]);

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    assertInstitutionConfigAccess(actor, actor.tenantId, "write");

    const body = await request.json() as Record<string, unknown>;
    const personId = typeof body.personId === "string" ? body.personId.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";

    if (!personId) return jsonError("personId is required.", 400);
    if (!ASSIGNABLE_ROLES.has(role as AcademyRole)) {
      return jsonError(`role must be one of: ${[...ASSIGNABLE_ROLES].join(", ")}`, 400);
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const personCheck = await client.query(
        `select id from academy_people where id = $1 and tenant_id = $2`,
        [personId, actor.tenantId],
      ) as { rowCount: number | null };

      if ((personCheck.rowCount ?? 0) === 0) {
        throw new Error(`Person ${personId} was not found in this institution.`);
      }

      const assignmentId = `ra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await client.query(
        `insert into academy_person_role_assignments
           (id, tenant_id, person_id, role, scope_type, status, starts_on)
         values ($1, $2, $3, $4, 'institution', 'active', current_date)
         on conflict do nothing`,
        [assignmentId, actor.tenantId, personId, role],
      );

      return { assignmentId, personId, role, status: "active" };
    });
  });
}
