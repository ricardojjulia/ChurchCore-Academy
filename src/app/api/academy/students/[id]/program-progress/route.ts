import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresStudentProgramProgressRepository,
  type StudentProgramProgressDatabase,
} from "@/modules/student-program-progress/postgres-repository";
import { StudentProgramProgressService } from "@/modules/student-program-progress/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new StudentProgramProgressService(
        new PostgresStudentProgramProgressRepository(
          asAcademyDatabase<StudentProgramProgressDatabase>(client),
        ),
      );
      const progress = await service.getProgress(actor, id);
      return { progress: progress ?? null };
    });
  });
}
