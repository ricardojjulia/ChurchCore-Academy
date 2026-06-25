import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

const attendanceReadRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "faculty",
  "teacher",
  "professor",
  "student",
]);

function hasAttendanceReadAccess(actor: AcademyActor) {
  return actor.roles.some((role) => attendanceReadRoles.has(role));
}

async function canAccessSectionData(
  actor: AcademyActor,
  sectionId: string,
  studentPersonId: string,
  db: Queryable,
): Promise<boolean> {
  const adminRoles = ["institution_admin", "dean", "registrar", "academic_admin"];
  const hasAdminAccess = actor.roles.some((role) => adminRoles.includes(role));

  if (hasAdminAccess) {
    return true;
  }

  // Faculty can access their own sections
  const facultyResult = await db.query(
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

  if (facultyResult.rows[0]) {
    return true;
  }

  // Students can access their own data only
  if (actor.roles.includes("student") && actor.userId === studentPersonId) {
    return true;
  }

  return false;
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    if (!hasAttendanceReadAccess(actor)) {
      throw new AcademyAuthorizationError("Forbidden attendance read access.");
    }

    const url = new URL(request.url);
    const sectionId = url.searchParams.get("sectionId");
    const studentPersonId = url.searchParams.get("studentId");

    if (!sectionId || !studentPersonId) {
      return { error: "sectionId and studentId are required" };
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<Queryable>(client);

      const canAccess = await canAccessSectionData(actor, sectionId, studentPersonId, db);
      if (!canAccess) {
        throw new AcademyAuthorizationError("Access denied to this section/student data.");
      }

      // Fetch section minimum attendance percentage
      const sectionResult = await db.query(
        `select minimum_attendance_percentage
         from academy_course_sections
         where tenant_id = $1
           and id = $2
         limit 1`,
        [actor.tenantId, sectionId],
      );

      const sectionRow = sectionResult.rows[0];
      if (!sectionRow) {
        return { error: "Section not found" };
      }

      const minimumAttendancePercentage = Number(sectionRow.minimum_attendance_percentage ?? 80);

      // Fetch attendance stats
      const statsResult = await db.query(
        `select
           count(*) filter (where status = 'present') as present_count,
           count(*) filter (where status = 'absent') as absent_count,
           count(*) as total_sessions
         from academy_attendance_records
         where tenant_id = $1
           and course_section_id = $2
           and student_person_id = $3`,
        [actor.tenantId, sectionId, studentPersonId],
      );

      const statsRow = statsResult.rows[0];
      const presentCount = Number(statsRow?.present_count ?? 0);
      const absentCount = Number(statsRow?.absent_count ?? 0);
      const totalSessions = Number(statsRow?.total_sessions ?? 0);

      if (totalSessions === 0) {
        return {
          sectionId,
          studentPersonId,
          minimumAttendancePercentage,
          attendancePercentage: 0,
          totalSessions: 0,
          presentCount: 0,
          absentCount: 0,
          belowThreshold: false,
        };
      }

      const attendancePercentage = Math.round((presentCount / totalSessions) * 100);
      const belowThreshold = minimumAttendancePercentage > 0 && attendancePercentage < minimumAttendancePercentage;

      return {
        sectionId,
        studentPersonId,
        minimumAttendancePercentage,
        attendancePercentage,
        totalSessions,
        presentCount,
        absentCount,
        belowThreshold,
      };
    });
  });
}
