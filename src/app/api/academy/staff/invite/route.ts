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

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    assertInstitutionConfigAccess(actor, actor.tenantId, "write");

    const body = await request.json() as Record<string, unknown>;
    const givenName = typeof body.givenName === "string" ? body.givenName.trim() : "";
    const familyName = typeof body.familyName === "string" ? body.familyName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const primaryRole = typeof body.primaryRole === "string" ? body.primaryRole.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!givenName) return jsonError("givenName is required", 400);
    if (!familyName) return jsonError("familyName is required", 400);
    if (!email || !email.includes("@")) return jsonError("Valid email is required", 400);
    if (!VALID_STAFF_ROLES.has(primaryRole as AcademyRole)) {
      return jsonError(`primaryRole must be one of: ${[...VALID_STAFF_ROLES].join(", ")}`, 400);
    }

    const displayName = `${givenName} ${familyName}`;
    const personId = `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const staffId = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const staffNumber = `STF-${Date.now().toString(36).toUpperCase()}`;

    return withAcademyDatabaseContext(actor, async (client) => {
      const existing = await client.query(
        `select id from academy_people where tenant_id = $1 and lower(email) = $2`,
        [actor.tenantId, email],
      ) as { rowCount: number | null };
      if ((existing.rowCount ?? 0) > 0) {
        throw new Error(`A person with email ${email} already exists in this institution.`);
      }

      await client.query(
        `insert into academy_people
           (id, tenant_id, display_name, given_name, family_name, email, person_status)
         values ($1, $2, $3, $4, $5, $6, 'active')`,
        [personId, actor.tenantId, displayName, givenName, familyName, email],
      );

      await client.query(
        `insert into academy_staff_profiles
           (id, tenant_id, person_id, staff_number, title, primary_role, employment_status)
         values ($1, $2, $3, $4, $5, $6, 'active')`,
        [staffId, actor.tenantId, personId, staffNumber, title || primaryRole, primaryRole],
      );

      return { personId, staffId, staffNumber, displayName, email, primaryRole };
    });
  });
}
