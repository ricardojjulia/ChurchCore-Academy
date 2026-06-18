import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertInstitutionConfigAccess, AcademyRole } from "@/modules/academy-auth/policy";

const VALID_STAFF_ROLES: ReadonlySet<AcademyRole> = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "advisor",
  "faculty",
  "teacher",
  "professor",
]);

const VALID_EMPLOYMENT_STATUSES = new Set([
  "active",
  "inactive",
  "adjunct",
  "volunteer",
  "archived",
]);

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);
    assertInstitutionConfigAccess(actor, actor.tenantId, "write");

    const body = await request.json() as Record<string, unknown>;
    const employmentStatus = typeof body.employmentStatus === "string" ? body.employmentStatus : undefined;
    const primaryRole = typeof body.primaryRole === "string" ? body.primaryRole : undefined;

    if (!employmentStatus && !primaryRole) {
      return jsonError("Provide employmentStatus or primaryRole to update.", 400);
    }
    if (employmentStatus && !VALID_EMPLOYMENT_STATUSES.has(employmentStatus)) {
      return jsonError("Invalid employmentStatus.", 400);
    }
    if (primaryRole && !VALID_STAFF_ROLES.has(primaryRole as AcademyRole)) {
      return jsonError("Invalid primaryRole.", 400);
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const check = await client.query(
        `select id from academy_staff_profiles where id = $1 and tenant_id = $2`,
        [id, actor.tenantId],
      ) as { rowCount: number | null };
      if ((check.rowCount ?? 0) === 0) {
        throw new Error(`Staff profile ${id} was not found.`);
      }

      const setClauses: string[] = [];
      const values: unknown[] = [];
      if (employmentStatus) {
        values.push(employmentStatus);
        setClauses.push(`employment_status = $${values.length}`);
      }
      if (primaryRole) {
        values.push(primaryRole);
        setClauses.push(`primary_role = $${values.length}`);
      }
      setClauses.push(`updated_at = now()`);
      values.push(id);
      values.push(actor.tenantId);

      await client.query(
        `update academy_staff_profiles
            set ${setClauses.join(", ")}
          where id = $${values.length - 1}
            and tenant_id = $${values.length}`,
        values,
      );

      return {
        id,
        ...(employmentStatus ? { employmentStatus } : {}),
        ...(primaryRole ? { primaryRole } : {}),
      };
    });
  });
}
