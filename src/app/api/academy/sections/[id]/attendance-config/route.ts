import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

const attendanceConfigRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "faculty",
  "teacher",
  "professor",
]);

function hasAttendanceConfigAccess(actor: AcademyActor) {
  return actor.roles.some((role) => attendanceConfigRoles.has(role));
}

async function canAccessSection(
  actor: AcademyActor,
  sectionId: string,
  db: Queryable,
): Promise<boolean> {
  const adminRoles = ["institution_admin", "dean", "registrar", "academic_admin"];
  const hasAdminAccess = actor.roles.some((role) => adminRoles.includes(role));

  if (hasAdminAccess) {
    return true;
  }

  // Faculty can only access their own sections
  const result = await db.query(
    `select true as can_access
     from academy_course_sections section
     where section.tenant_id = $1
       and section.id = $2
       and (
         section.primary_instructor_id = $3
         or section.assistant_instructor_ids ? $3
       )
     limit 1`,
    [actor.tenantId, sectionId, actor.userId],
  );

  return Boolean(result.rows[0]);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (!hasAttendanceConfigAccess(actor)) {
      throw new AcademyAuthorizationError("Forbidden attendance config access.");
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<Queryable>(client);

      const canAccess = await canAccessSection(actor, id, db);
      if (!canAccess) {
        throw new AcademyAuthorizationError("Faculty can access only assigned sections.");
      }

      const result = await db.query(
        `select minimum_attendance_percentage
         from academy_course_sections
         where tenant_id = $1
           and id = $2
         limit 1`,
        [actor.tenantId, id],
      );

      const row = result.rows[0];
      if (!row) {
        return { error: "Section not found" };
      }

      return {
        sectionId: id,
        minimumAttendancePercentage: Number(row.minimum_attendance_percentage ?? 80),
      };
    });
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (!hasAttendanceConfigAccess(actor)) {
      throw new AcademyAuthorizationError("Forbidden attendance config access.");
    }

    const { minimumAttendancePercentage } = body;

    if (typeof minimumAttendancePercentage !== "number") {
      return { error: "minimumAttendancePercentage must be a number" };
    }

    if (minimumAttendancePercentage < 0 || minimumAttendancePercentage > 100) {
      return { error: "minimumAttendancePercentage must be between 0 and 100" };
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<Queryable>(client);

      const canAccess = await canAccessSection(actor, id, db);
      if (!canAccess) {
        throw new AcademyAuthorizationError("Faculty can access only assigned sections.");
      }

      const result = await db.query(
        `update academy_course_sections
         set minimum_attendance_percentage = $3,
             updated_at = now()
         where tenant_id = $1
           and id = $2
         returning minimum_attendance_percentage`,
        [actor.tenantId, id, minimumAttendancePercentage],
      );

      const row = result.rows[0];
      if (!row) {
        return { error: "Section not found" };
      }

      return {
        sectionId: id,
        minimumAttendancePercentage: Number(row.minimum_attendance_percentage),
      };
    });
  });
}
