import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresStudentGroupRepository,
  type StudentGroupDatabase,
} from "@/modules/student-groups/postgres-repository";
import { StudentGroupService } from "@/modules/student-groups/service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; membershipId: string }> },
) {
  return handleApi(async () => {
    const { id, membershipId } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new StudentGroupService(
        new PostgresStudentGroupRepository(asAcademyDatabase<StudentGroupDatabase>(client)),
      );
      await service.removeMember(actor, id, membershipId);
      return { removed: true };
    });
  });
}
