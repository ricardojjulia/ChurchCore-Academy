import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import type {
  AttendanceRecord,
  AttendanceRepository,
  AttendanceRequestInput,
} from "@/modules/attendance/types";
import { validateAttendanceInput } from "@/modules/attendance/types";
import type {
  AttendanceThresholdConfig,
  AttendanceThresholdDatabase,
} from "@/modules/attendance/threshold-evaluator";
import { checkAttendanceThreshold } from "@/modules/attendance/threshold-evaluator";
import { checkGuardianNotification } from "@/modules/attendance/guardian-notifier";
import type { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import type { CommunicationsService } from "@/modules/communications/service";
import { emitOperationalEvent } from "@/modules/observability/operational-events";

/**
 * Runs a side effect inside its own savepoint on the request's transaction, awaited.
 *
 * These checks used to be fired without `await` and their errors swallowed. A failing query
 * still aborted the shared transaction, so the request's COMMIT silently rolled back the
 * attendance record itself while the API returned 200 (found 2026-10-08: every faculty attendance
 * save was lost). Unawaited queries could also run after the connection went back to the pool.
 * A savepoint confines a failure to the side effect; the attendance record always commits.
 */
async function runIsolatedSideEffect(
  database: AttendanceThresholdDatabase,
  savepoint: "attendance_threshold_check" | "attendance_guardian_check",
  actor: AcademyActor,
  effect: () => Promise<unknown>,
) {
  await database.query(`savepoint ${savepoint}`);
  try {
    await effect();
    await database.query(`release savepoint ${savepoint}`);
  } catch (error) {
    await database.query(`rollback to savepoint ${savepoint}`);
    await database.query(`release savepoint ${savepoint}`);
    emitOperationalEvent({
      category: "workflow_exception",
      severity: "warn",
      operation: `attendance.${savepoint}`,
      tenantId: actor.tenantId,
      message: "Attendance side effect failed; the attendance record was still saved.",
      metadata: {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

const attendanceWriteRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "faculty",
  "teacher",
  "professor",
]);

const attendanceAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

function hasAttendanceWriteAccess(actor: AcademyActor) {
  return actor.roles.some((role) => attendanceWriteRoles.has(role));
}

/** Oversight roles that may record attendance for any section; everyone else only their own. */
export function hasAttendanceAdminAccess(actor: AcademyActor) {
  return actor.roles.some((role) => attendanceAdminRoles.has(role));
}

export interface AttendanceServiceDependencies {
  repository: AttendanceRepository;
  thresholdDatabase?: AttendanceThresholdDatabase;
  thresholdConfig?: AttendanceThresholdConfig;
  shepherdRepo?: ShepherdAiPostgresRepository;
  communicationsService?: CommunicationsService;
}

export class AttendanceService {
  private readonly repository: AttendanceRepository;
  private readonly thresholdDatabase?: AttendanceThresholdDatabase;
  private readonly thresholdConfig?: AttendanceThresholdConfig;
  private readonly shepherdRepo?: ShepherdAiPostgresRepository;
  private readonly communicationsService?: CommunicationsService;

  constructor(deps: AttendanceServiceDependencies | AttendanceRepository) {
    if ("upsert" in deps) {
      // Legacy constructor signature for backwards compatibility
      this.repository = deps;
    } else {
      this.repository = deps.repository;
      this.thresholdDatabase = deps.thresholdDatabase;
      this.thresholdConfig = deps.thresholdConfig;
      this.shepherdRepo = deps.shepherdRepo;
      this.communicationsService = deps.communicationsService;
    }
  }

  async recordAttendance(
    actor: AcademyActor,
    input: AttendanceRequestInput,
  ): Promise<AttendanceRecord> {
    if (!hasAttendanceWriteAccess(actor)) {
      throw new AcademyAuthorizationError("Forbidden attendance write access.");
    }

    const canRecord = await this.repository.canRecordSectionAttendance({
      tenantId: actor.tenantId,
      courseSectionId: input.courseSectionId,
      actorPersonId: actor.userId,
      hasAdminAccess: hasAttendanceAdminAccess(actor),
    });

    if (!canRecord) {
      throw new AcademyAuthorizationError(
        "Faculty can record attendance only for assigned sections.",
      );
    }

    const studentRegistered = await this.repository.isStudentActivelyRegistered({
      tenantId: actor.tenantId,
      courseSectionId: input.courseSectionId,
      studentPersonId: input.studentPersonId,
    });

    if (!studentRegistered) {
      throw new AcademyConflictError(
        "Student must have an active section registration before attendance can be recorded.",
      );
    }

    const record = await this.repository.upsert(
      validateAttendanceInput({
        tenantId: actor.tenantId,
        courseSectionId: input.courseSectionId,
        studentPersonId: input.studentPersonId,
        sessionDate: input.sessionDate,
        status: input.status,
        sessionType: input.sessionType ?? "class",
        recordedByPersonId: actor.userId,
        note: input.note,
      }),
    );

    // Threshold signal and guardian notification: awaited, each isolated in a savepoint so a
    // failure can never roll back the attendance record (see runIsolatedSideEffect).
    if (
      this.thresholdDatabase &&
      this.thresholdConfig &&
      this.shepherdRepo &&
      this.communicationsService
    ) {
      const database = this.thresholdDatabase;
      const config = this.thresholdConfig;
      const shepherdRepo = this.shepherdRepo;
      const communicationsService = this.communicationsService;

      await runIsolatedSideEffect(database, "attendance_threshold_check", actor, () =>
        checkAttendanceThreshold(
          actor.tenantId,
          input.studentPersonId,
          input.courseSectionId,
          config,
          database,
          shepherdRepo,
          communicationsService,
          actor,
        ),
      );

      await runIsolatedSideEffect(database, "attendance_guardian_check", actor, () =>
        checkGuardianNotification(
          actor.tenantId,
          input.studentPersonId,
          input.courseSectionId,
          input.sessionDate,
          input.status,
          input.sessionType ?? "class",
          database,
          communicationsService,
          actor,
        ),
      );
    }

    return record;
  }
}
