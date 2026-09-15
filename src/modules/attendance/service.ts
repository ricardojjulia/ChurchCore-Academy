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

function hasAttendanceAdminAccess(actor: AcademyActor) {
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

    // Non-blocking threshold check and guardian notification (fire and forget)
    if (
      this.thresholdDatabase &&
      this.thresholdConfig &&
      this.shepherdRepo &&
      this.communicationsService
    ) {
      // Check attendance threshold for ShepherdAI signal
      checkAttendanceThreshold(
        actor.tenantId,
        input.studentPersonId,
        input.courseSectionId,
        this.thresholdConfig,
        this.thresholdDatabase,
        this.shepherdRepo,
        this.communicationsService,
        actor,
      ).catch(() => {
        // Threshold check failure should not fail the attendance record
        // Errors are swallowed to keep the operation non-blocking
      });

      // Check guardian notification for consecutive absences / spiritual formation
      checkGuardianNotification(
        actor.tenantId,
        input.studentPersonId,
        input.courseSectionId,
        input.sessionDate,
        input.status,
        input.sessionType ?? "class",
        this.thresholdDatabase,
        this.communicationsService,
        actor,
      ).catch(() => {
        // Guardian notification failure should not fail the attendance record
        // Errors are swallowed to keep the operation non-blocking
      });
    }

    return record;
  }
}
