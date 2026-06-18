import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresAttendanceRepository,
  type AttendanceDatabase,
} from "@/modules/attendance/postgres-repository";
import { validateAttendanceInput } from "@/modules/attendance/types";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;

    const { actor } = await resolveAcademyActorFromSession(request);
    const input = validateAttendanceInput({
      tenantId: actor.tenantId,
      courseSectionId: typeof body.courseSectionId === "string" ? body.courseSectionId : undefined,
      studentPersonId: typeof body.studentPersonId === "string" ? body.studentPersonId : undefined,
      sessionDate: typeof body.sessionDate === "string" ? body.sessionDate : undefined,
      status: typeof body.status === "string" ? body.status as never : undefined,
      recordedByPersonId: actor.userId,
      note: typeof body.note === "string" ? body.note : undefined,
    });

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresAttendanceRepository(
        asAcademyDatabase<AttendanceDatabase>(client),
      );
      return repository.upsert(input);
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
        return repository.listByStudent(actor.tenantId, studentId);
      }

      if (sectionId) {
        return repository.listBySection(actor.tenantId, sectionId, sessionDate);
      }

      throw new Error("sectionId or studentId is required.");
    });
  });
}
