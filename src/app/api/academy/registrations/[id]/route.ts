import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";

const VALID_STATUSES = new Set(["registered", "waitlisted", "withdrawn", "completed"]);

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);
    assertInstitutionConfigAccess(actor, actor.tenantId, "write");

    const body = await request.json() as Record<string, unknown>;
    const status = typeof body.status === "string" ? body.status : undefined;

    if (!status) return jsonError("status is required.", 400);
    if (!VALID_STATUSES.has(status)) return jsonError("Invalid registration status.", 400);

    return withAcademyDatabaseContext(actor, async (client) => {
      const check = await client.query(
        `select id from academy_course_section_registrations
          where id = $1 and tenant_id = $2`,
        [id, actor.tenantId],
      ) as { rowCount: number | null };

      if ((check.rowCount ?? 0) === 0) {
        throw new Error(`Registration ${id} was not found.`);
      }

      await client.query(
        `update academy_course_section_registrations
            set status = $1
          where id = $2 and tenant_id = $3`,
        [status, id, actor.tenantId],
      );

      return { id, status };
    });
  });
}
