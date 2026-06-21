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

export class AttendanceService {
  constructor(private readonly repository: AttendanceRepository) {}

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

    return this.repository.upsert(
      validateAttendanceInput({
        tenantId: actor.tenantId,
        courseSectionId: input.courseSectionId,
        studentPersonId: input.studentPersonId,
        sessionDate: input.sessionDate,
        status: input.status,
        recordedByPersonId: actor.userId,
        note: input.note,
      }),
    );
  }
}
