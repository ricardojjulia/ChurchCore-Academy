import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { computeAttendanceRateSignal } from "@/modules/attendance/threshold-evaluator";
import type { AttendanceThresholdDatabase } from "@/modules/attendance/threshold-evaluator";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";

const attendanceWriteRoles = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "faculty",
  "teacher",
  "professor",
]);

function hasAttendanceWriteAccess(actorRoles: string[]) {
  return actorRoles.some((role) => attendanceWriteRoles.has(role));
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const sectionId = typeof body.sectionId === "string" ? body.sectionId : "";

    if (!sectionId) {
      throw new Error("sectionId is required.");
    }

    const { actor } = await resolveAcademyActorFromSession(request);

    if (!hasAttendanceWriteAccess(actor.roles)) {
      throw new AcademyAuthorizationError("Forbidden attendance write access.");
    }

    return withAcademyDatabaseContext(actor, async (client) => {
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
        : {
            warningPct: 15.0,
            alertPct: 25.0,
            excusedCounts: false,
          };

      const shepherdRepo = new ShepherdAiPostgresRepository(
        asAcademyDatabase(client),
      );

      await computeAttendanceRateSignal(
        actor.tenantId,
        sectionId,
        thresholdConfig,
        asAcademyDatabase<AttendanceThresholdDatabase>(client),
        shepherdRepo,
      );

      return { status: "signals_computed" };
    });
  });
}
