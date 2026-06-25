import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresAttendanceRepository,
  type AttendanceDatabase,
} from "@/modules/attendance/postgres-repository";
import { AttendanceService } from "@/modules/attendance/service";
import type { AttendanceStatus } from "@/modules/attendance/types";
import type { AttendanceThresholdDatabase } from "@/modules/attendance/threshold-evaluator";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import { CommunicationsService } from "@/modules/communications/service";
import { PostgresCommunicationsRepository } from "@/modules/communications/postgres-repository";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

const attendanceReadStaffRoles = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "faculty",
  "teacher",
  "professor",
]);

function canReadAttendanceStaff(actorRoles: string[]) {
  return actorRoles.some((role) => attendanceReadStaffRoles.has(role));
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;

    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresAttendanceRepository(
        asAcademyDatabase<AttendanceDatabase>(client),
      );

      // Fetch threshold config from institution profile
      const configResult = await client.query(
        `select
           attendance_warning_threshold_pct,
           attendance_alert_threshold_pct,
           attendance_excused_counts_toward_threshold
         from academy_institution_profiles
         where tenant_id = $1
         limit 1`,
        [actor.tenantId],
      );

      const configRow = (configResult as { rows: Record<string, unknown>[] }).rows[0];
      const thresholdConfig = configRow
        ? {
            warningPct: Number(configRow.attendance_warning_threshold_pct ?? 15.0),
            alertPct: Number(configRow.attendance_alert_threshold_pct ?? 25.0),
            excusedCounts: Boolean(configRow.attendance_excused_counts_toward_threshold ?? false),
          }
        : undefined;

      // Wire up threshold evaluator dependencies
      const shepherdRepo = new ShepherdAiPostgresRepository(
        asAcademyDatabase(client),
      );
      const communicationsRepo = new PostgresCommunicationsRepository(
        asAcademyDatabase(client),
      );
      const communicationsService = new CommunicationsService(communicationsRepo);

      const service = new AttendanceService({
        repository,
        thresholdDatabase: thresholdConfig
          ? asAcademyDatabase<AttendanceThresholdDatabase>(client)
          : undefined,
        thresholdConfig,
        shepherdRepo: thresholdConfig ? shepherdRepo : undefined,
        communicationsService: thresholdConfig ? communicationsService : undefined,
      });

      return service.recordAttendance(actor, {
        courseSectionId:
          typeof body.courseSectionId === "string" ? body.courseSectionId : "",
        studentPersonId:
          typeof body.studentPersonId === "string" ? body.studentPersonId : "",
        sessionDate: typeof body.sessionDate === "string" ? body.sessionDate : "",
        status: body.status as AttendanceStatus,
        note: typeof body.note === "string" ? body.note : undefined,
      });
    });
  });
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const studentId = searchParams.get("studentId");
    const sessionDate = searchParams.get("sessionDate") ?? undefined;

    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresAttendanceRepository(
        asAcademyDatabase<AttendanceDatabase>(client),
      );

      if (studentId) {
        if (!canReadAttendanceStaff(actor.roles) && studentId !== actor.userId) {
          throw new AcademyAuthorizationError(
            "Students can read only their own attendance records.",
          );
        }
        return repository.listByStudent(actor.tenantId, studentId);
      }

      if (sectionId) {
        if (!canReadAttendanceStaff(actor.roles)) {
          throw new AcademyAuthorizationError(
            "Forbidden attendance section read access.",
          );
        }
        return repository.listBySection(actor.tenantId, sectionId, sessionDate);
      }

      throw new Error("sectionId or studentId is required.");
    });
  });
}
